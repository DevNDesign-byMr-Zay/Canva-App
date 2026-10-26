"""Safe diagnostics never serialize exception messages, URLs or request data."""
import json
import re
import socket

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from diagnostics import DiagnosticMiddleware, log_failure

SECRET = "api_key=secret-123 private-user@example.com /private/customer.png"


def test_unexpected_failure_is_correlated_and_redacted(caplog):
    app = FastAPI()
    app.add_middleware(DiagnosticMiddleware, service="test-backend")
    @app.get("/fail/{item}")
    async def fail(item: str):
        raise RuntimeError(SECRET)
    response = TestClient(app).get("/fail/private-id?token=secret-123", headers={"Authorization": "Bearer secret-123", "X-Request-ID": SECRET})
    assert response.status_code == 500
    request_id = response.headers["x-request-id"]
    assert re.fullmatch(r"[0-9a-f]{32}", request_id)
    assert response.json() == {"detail": "Internal server error", "requestId": request_id}
    record = json.loads(next(record.message for record in caplog.records if record.name == "canva.diagnostics"))
    assert record["request_id"] == request_id
    assert record["exception_type"] == "RuntimeError"
    assert record["category"] == "internal"
    assert record["route"] == "/fail/{item}"
    assert record["frames"][-1]["function"] == "fail"
    serialized = json.dumps(record) + response.text
    for value in [SECRET, "secret-123", "private-user", "private-id"]:
        assert value not in serialized


def test_http_errors_and_success_preserve_existing_contracts():
    app = FastAPI()
    app.add_middleware(DiagnosticMiddleware, service="test-backend")
    @app.get("/unauthorized")
    async def unauthorized():
        raise HTTPException(status_code=401, detail="Authentication required")
    @app.get("/ok")
    async def ok():
        return {"ok": True}
    client = TestClient(app)
    response = client.get("/unauthorized")
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}
    assert client.get("/ok").json() == {"ok": True}
    assert client.get("/ok").headers["x-request-id"] != client.get("/ok").headers["x-request-id"]


def test_job_failure_uses_allowlisted_context_and_error_classification(caplog):
    log_failure("job_failed", TimeoutError(SECRET), job_id="job_123", stage="rendering")
    record = json.loads(caplog.records[-1].message)
    assert record["category"] == "timeout"
    assert record["job_id"] == "job_123"
    assert record["stage"] == "rendering"
    assert SECRET not in caplog.text


def test_real_backend_installs_diagnostics():
    import app
    assert "x-request-id" in TestClient(app.app).get("/health").headers


def test_default_backend_tests_block_outbound_network():
    with pytest.raises(AssertionError, match="network"):
        socket.create_connection(("example.com", 443), timeout=0.01)


def test_stream_failure_does_not_propagate_private_exception_text(caplog):
    import asyncio
    async def fail_after_headers(scope, receive, send):
        await send({'type': 'http.response.start', 'status': 200, 'headers': []})
        raise RuntimeError(SECRET)
    middleware = DiagnosticMiddleware(fail_after_headers, service='test-backend')
    async def receive():
        return {'type': 'http.request', 'body': b''}
    async def send(message):
        pass
    with pytest.raises(RuntimeError, match='Response streaming failed') as caught:
        asyncio.run(middleware({'type': 'http'}, receive, send))
    assert SECRET not in str(caught.value)
    assert SECRET not in caplog.text


def test_non_http_scope_passes_through():
    import asyncio
    seen = []
    async def app(scope, receive, send):
        seen.append(scope['type'])
    asyncio.run(DiagnosticMiddleware(app, service='test-backend')({'type': 'lifespan'}, None, None))
    assert seen == ['lifespan']


def test_socket_connect_ex_is_blocked():
    with socket.socket() as sock:
        with pytest.raises(AssertionError, match='network'):
            sock.connect_ex(('127.0.0.1', 1))


def test_cors_preflight_has_correlation_and_browser_can_read_request_id():
    from fastapi.middleware.cors import CORSMiddleware
    app = FastAPI()
    @app.get('/ok')
    async def ok():
        return {'ok': True}
    app.add_middleware(CORSMiddleware, allow_origins=['https://canva.example'], allow_methods=['GET'], expose_headers=['X-Request-ID'])
    app.add_middleware(DiagnosticMiddleware, service='test-backend')
    client = TestClient(app)
    preflight = client.options('/ok', headers={'Origin': 'https://canva.example', 'Access-Control-Request-Method': 'GET'})
    assert preflight.status_code == 200
    assert 'x-request-id' in preflight.headers
    response = client.get('/ok', headers={'Origin': 'https://canva.example'})
    assert 'x-request-id' in response.headers['access-control-expose-headers'].lower()


def test_http_background_failure_keeps_request_and_job_correlation(caplog):
    from fastapi import BackgroundTasks
    from diagnostics import run_background_job
    app = FastAPI()
    app.add_middleware(DiagnosticMiddleware, service='test-backend')
    async def fail():
        raise RuntimeError(SECRET)
    @app.post('/jobs', status_code=202)
    async def create(tasks: BackgroundTasks):
        tasks.add_task(run_background_job, 'job_456', fail)
        return {'jobId': 'job_456'}
    response = TestClient(app).post('/jobs')
    assert response.status_code == 202
    record = json.loads(next(r.message for r in caplog.records if r.name == 'canva.diagnostics'))
    assert record['job_id'] == 'job_456'
    assert record['request_id'] == response.headers['x-request-id']
    assert SECRET not in caplog.text


def test_configured_backend_cors_exposes_correlation(monkeypatch):
    import importlib
    import app as module
    try:
        with monkeypatch.context() as patch:
            patch.setenv('CANVA_APP_ORIGIN', 'https://canva.example')
            module = importlib.reload(module)
            client = TestClient(module.app)
            preflight = client.options('/health', headers={'Origin': 'https://canva.example', 'Access-Control-Request-Method': 'GET'})
            assert preflight.status_code == 200
            assert 'x-request-id' in preflight.headers
            response = client.get('/health', headers={'Origin': 'https://canva.example'})
            assert 'x-request-id' in response.headers['access-control-expose-headers'].lower()
    finally:
        importlib.reload(module)
