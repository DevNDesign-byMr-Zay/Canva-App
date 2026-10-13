"""Regression checks from live fal.ai provider media delivery."""

import pytest
from fastapi import HTTPException

from providers.media import fal_media_target


def test_real_fal_v3b_cdn_is_retrievable():
    base, path = fal_media_target(
        "https://v3b.fal.media/files/b/example/example.png"
    )
    assert base == "https://v3b.fal.media"
    assert path == "/files/b/example/example.png"


@pytest.mark.parametrize("url", [
    "https://v3b.fal.media.evil.example/files/b/a.png",
    "http://v3b.fal.media/files/b/a.png",
    "https://evil.example/files/b/a.png",
    "https://v3b.fal.media//other-host/path",
])
def test_untrusted_provider_media_hosts_are_still_rejected(url):
    with pytest.raises(HTTPException) as exc:
        fal_media_target(url)
    assert exc.value.status_code == 502
