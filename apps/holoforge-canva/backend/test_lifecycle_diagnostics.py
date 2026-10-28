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
    assert [record["event"] for record in records] == ["background_job_started", "background_job_completed"]
    assert all(record["level"] == "INFO" and record["job_id"] == "job_123" for record in records)
    assert "PRIVATE_ARTWORK_PAYLOAD" not in caplog.text


def test_background_failure_never_logs_a_completion_or_private_exception_name(caplog):
    caplog.set_level(logging.INFO, logger="canva.diagnostics")
    private_error = type("PRIVATE_PROVIDER_TOKEN", (Exception,), {})
    async def fail():
        raise private_error("Bearer PRIVATE_TOKEN /private/customer.png")
    assert asyncio.run(run_background_job("job_456", fail)) is None
    records = [json.loads(record.message) for record in caplog.records if record.name == "canva.diagnostics"]
    assert [record["event"] for record in records] == ["background_job_started", "background_job_failed"]
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
    assert [record["event"] for record in records] == ["background_job_started"]
