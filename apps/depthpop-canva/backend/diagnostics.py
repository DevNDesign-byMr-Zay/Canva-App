"""Allowlisted JSON diagnostics. Never serialize exception text or request data."""
from __future__ import annotations

import contextvars
import json
import logging
import re
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

from starlette.responses import JSONResponse

_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar('request_id', default=None)
logger = logging.getLogger('canva.diagnostics')
SAFE_JOB_ERROR = 'Processing failed. Contact support with the job ID.'


def _identifier(value: str | None) -> str | None:
    return value if value and re.fullmatch(r'[A-Za-z0-9_.-]{1,96}', value) else None


def log_failure(event: str, exc: Exception, *, job_id: str | None = None, stage: str | None = None, route: str | None = None, service: str | None = None) -> None:
    name = type(exc).__name__
    category = 'timeout' if 'timeout' in name.lower() else (
        'storage' if isinstance(exc, OSError) else 'internal'
    )
    # Traceback structure is useful; source lines, locals and messages are private.
    frames = [
        {'file': Path(frame.filename).name, 'function': frame.name, 'line': frame.lineno}
        for frame in traceback.extract_tb(exc.__traceback__)[-8:]
    ]
    record = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'event': _identifier(event), 'service': _identifier(service),
        'request_id': _request_id.get(), 'job_id': _identifier(job_id),
        'stage': _identifier(stage), 'exception_type': name,
        'category': category, 'frames': frames,
    }
    if route is not None:
        record['route'] = route  # Only the router's static template, never raw URL/path.
    logger.error(json.dumps(record, separators=(',', ':')))


class DiagnosticMiddleware:
    def __init__(self, app, *, service: str) -> None:
        self.app = app
        self.service = service

    async def __call__(self, scope, receive, send) -> None:
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        request_id = uuid.uuid4().hex
        token = _request_id.set(request_id)
        started = False
        async def correlated_send(message):
            nonlocal started
            if message['type'] == 'http.response.start':
                started = True
                message = dict(message)
                headers = [(key, value) for key, value in message.get('headers', []) if key.lower() != b'x-request-id']
                message['headers'] = headers + [(b'x-request-id', request_id.encode('ascii'))]
            await send(message)
        try:
            await self.app(scope, receive, correlated_send)
        except Exception as exc:
            route = getattr(scope.get('route'), 'path', None)
            log_failure('request_failed', exc, route=route, service=self.service)
            if started:
                # Preserve stream failure semantics without logging the private exception text.
                raise RuntimeError('Response streaming failed') from None
            response = JSONResponse({'detail': 'Internal server error', 'requestId': request_id}, status_code=500)
            await response(scope, receive, correlated_send)
        finally:
            _request_id.reset(token)


async def run_background_job(correlation_job_id, function, *args, **kwargs):
    """Consume failures outside a runner's normal persistence/cleanup boundary."""
    try:
        return await function(*args, **kwargs)
    except Exception as exc:
        log_failure('background_job_failed', exc, job_id=correlation_job_id, stage='runner')
        return None
