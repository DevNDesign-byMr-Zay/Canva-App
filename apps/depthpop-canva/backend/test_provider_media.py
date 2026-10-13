from providers.media import fal_media_target


def test_fal_media_target_accepts_documented_v3b_cdn_host():
    base, target = fal_media_target(
        "https://v3b.fal.media/files/b/example/generated.png"
    )
    assert base == "https://v3b.fal.media"
    assert target == "/files/b/example/generated.png"


def test_fal_media_target_still_rejects_untrusted_hosts():
    try:
        fal_media_target("https://example.com/generated.png")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 502
    else:
        raise AssertionError("untrusted provider host should be rejected")
