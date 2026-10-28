import asyncio
import json
import logging

from diagnostics import log_failure, run_background_job


def test_background_success_logs_bounded_lifecycle_and_preserves_result(caplog):
    caplog.set_level(logging.INFO, logger="canva.diagnostics")
    async def succeed():
        return {"result": "PRIVATE_ARTWORK_PAYLOAD"}
    result = asyncio.run(run_background_job("job_123", succeed))
    assert result == {"result": "PRIVATE_ARTWORK_PAYLOAD"}
    records = [json.loads(record.message) for record in caplog.records if record.name == "canva.diagnostics"]
    assert [record["event"] for record in records] == ["background_runner_started", "background_runner_returned"]
    assert all(record["level"] == "INFO" and record["job_id"] == "job_123" for record in records)
    assert "PRIVATE_ARTWORK_PAYLOAD" not in caplog.text


def test_background_failure_never_logs_a_completion_or_private_exception_name(caplog):
    caplog.set_level(logging.INFO, logger="canva.diagnostics")
    private_error = type("PRIVATE_PROVIDER_TOKEN", (Exception,), {})
    async def fail():
        raise private_error("Bearer PRIVATE_TOKEN /private/customer.png")
    assert asyncio.run(run_background_job("job_456", fail)) is None
    records = [json.loads(record.message) for record in caplog.records if record.name == "canva.diagnostics"]
    assert [record["event"] for record in records] == ["background_runner_started", "background_job_failed"]
    assert records[-1]["exception_type"] == "Exception"
    assert records[-1]["level"] == "ERROR"
    assert records[-1]["category"] == "internal"
    assert all(record["job_id"] == "job_456" for record in records)
    assert "PRIVATE" not in caplog.text


def test_failure_category_is_not_controlled_by_untrusted_class_name(caplog):
    error_type = type("CustomerTimeoutSecret", (Exception,), {})
    log_failure("job_failed", error_type("PRIVATE"), job_id="job_789")
    record = json.loads(caplog.records[-1].message)
    assert record["category"] == "internal"
    assert record["exception_type"] == "Exception"
    assert "CustomerTimeoutSecret" not in caplog.text


def test_background_cancellation_does_not_emit_success(caplog):
    caplog.set_level(logging.INFO, logger="canva.diagnostics")
    async def cancel():
        raise asyncio.CancelledError()
    try:
        asyncio.run(run_background_job("job_cancel", cancel))
    except asyncio.CancelledError:
        pass
    else:
        raise AssertionError("cancellation must propagate")
    records = [json.loads(record.message) for record in caplog.records if record.name == "canva.diagnostics"]
    assert [record["event"] for record in records] == ["background_runner_started"]


def test_segmentation_failure_keeps_request_job_stage_and_redacts_public_error(monkeypatch, caplog):
    import io
    from types import SimpleNamespace
    from PIL import Image
    from api import scenes
    from diagnostics import _request_id
    from models.scene import DepthPopSceneSettings
    from services.scene_builder import SceneBuilderService
    updates = []
    async def update(job_id, **fields):
        updates.append((job_id, fields))
    async def fail(*args, **kwargs):
        raise TimeoutError("PRIVATE_FAL_TOKEN private-user@example.com /private/artwork.png")
    monkeypatch.setattr(scenes.job_repo, "update_job_stage", update)
    monkeypatch.setattr(scenes.scene_asset_repo, "cleanup_scene_assets_sync", lambda scene_id: None)
    builder = SceneBuilderService(segmentation_service=SimpleNamespace(segment_objects=fail), depth_service=SimpleNamespace(), inpainting_service=SimpleNamespace())
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4)).save(buffer, format="PNG")
    token = _request_id.set("a" * 32)
    try:
        asyncio.run(scenes.run_scene_decomposition_job(job_id="job_segment", scene_id="scene_segment", raw_image_bytes=buffer.getvalue(), source_asset_id="asset_segment", url_builder=lambda *_: "unused", max_objects=2, segmentation_mode="auto", depth_quality="high", inpaint=False, scene_settings=DepthPopSceneSettings(), inpaint_steps=14, user_id="private-user", brand_id="private-brand", builder_service=builder))
    finally:
        _request_id.reset(token)
    record = json.loads(next(r.message for r in caplog.records if r.name == "canva.diagnostics"))
    assert record["event"] == "scene_decomposition_failed"
    assert record["request_id"] == "a" * 32
    assert record["job_id"] == "job_segment"
    assert record["stage"] == "segmenting_objects"
    assert record["category"] == "timeout"
    assert updates[-1][1]["status"] == "error"
    assert updates[-1][1]["error"] == "Processing failed. Contact support with the job ID."
    for secret in ["PRIVATE_FAL_TOKEN", "private-user", "private-brand", "/private/artwork.png"]:
        assert secret not in caplog.text + updates[-1][1]["error"]
