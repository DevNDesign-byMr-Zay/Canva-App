import asyncio
import json

from models.export import ExportRequest
import services.export_jobs as jobs


def test_failed_export_redacts_job_response_and_logs_job_id(monkeypatch, caplog):
    async def fail(*args, **kwargs):
        raise RuntimeError('Bearer private-token /private/customer.png')
    monkeypatch.setattr(jobs.scene_repo, 'get_scene', fail)
    request = ExportRequest(format='scene-json')
    job = jobs.create_export_job(scene_id='scene-x', user_id='u', brand_id='b', request=request)
    jobs.remember_runner_owner(job)
    asyncio.run(jobs.run_export_job(job.jobId, request, fetch_asset=fail))
    failed = jobs.export_repo.get_job(job.jobId, user_id='u', brand_id='b')
    assert failed.status == 'failed'
    assert 'private-token' not in failed.error
    record = json.loads(next(r.message for r in caplog.records if r.name == 'canva.diagnostics'))
    assert record['job_id'] == failed.jobId
    assert 'private-token' not in caplog.text
