from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient

CANVA_APP_ID = os.getenv("CANVA_APP_ID", "").strip()
_jwks_client: PyJWKClient | None = None


@dataclass(frozen=True)
class VerifiedCanvaUser:
    user_id: str
    brand_id: str


def _extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Canva authorization token")
    scheme, _, token = authorization.strip().partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Invalid Canva authorization header")
    return token.strip()


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if not CANVA_APP_ID:
        raise HTTPException(status_code=503, detail="CANVA_APP_ID is not configured")
    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            "https://api.canva.com/rest/v1/apps/" + CANVA_APP_ID + "/jwks",
            cache_keys=True,
            max_cached_keys=16,
            lifespan=3600,
        )
    return _jwks_client


async def verify_canva_user(
    authorization: str | None = Header(default=None),
) -> VerifiedCanvaUser:
    token = _extract_bearer(authorization)
    try:
        signing_key = await asyncio.to_thread(
            _get_jwks_client().get_signing_key_from_jwt,
            token,
        )
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CANVA_APP_ID,
            options={"require": ["aud", "exp"]},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Canva authorization token") from exc

    user_id = str(claims.get("userId") or "").strip()
    brand_id = str(claims.get("brandId") or "").strip()
    if not user_id or not brand_id:
        raise HTTPException(status_code=401, detail="Canva user identity is incomplete")
    return VerifiedCanvaUser(user_id=user_id, brand_id=brand_id)
