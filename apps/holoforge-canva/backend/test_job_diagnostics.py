import asyncio
import json
from types import SimpleNamespace

from export_service import ExportService
from models import ExportSubmission
from repositories import ArtifactRepository, JobRepository, OwnedKey
from test_models import request_payload, scene_payload


def test_failed_render_redacts_job_response_and_logs_job_id(monkeypatch, tmp_path, caplog):
    import repositories
    monkeypatch.setattr(repositories, 'ARTIFACT_ROOT', tmp_path)
    async def fail(*args):
        raise RuntimeError('Bearer private-token /private/customer.png')
    jobs = JobRepository()
    service = ExportService(jobs=jobs, artifacts=ArtifactRepository(), renderers=SimpleNamespace(resolve=lambda fmt: SimpleNamespace(render=fail)))
    async def execute():
        job, _ = service.create(ExportSubmission(scene=scene_payload(), request=request_payload('scene-json')), user_id='u', brand_id='b')
        await asyncio.gather(*service._tasks)
        return jobs.get(OwnedKey('u', 'b', job.id))
    failed = asyncio.run(execute())
    assert failed.status == 'error'
    assert 'private-token' not in failed.error
    record = json.loads(next(r.message for r in caplog.records if r.name == 'canva.diagnostics'))
    assert record['job_id'] == failed.id
    assert record['stage'] == 'rendering'
    assert 'private-token' not in caplog.text


def test_persistence_failure_is_consumed_and_safely_correlated(monkeypatch, tmp_path, caplog):
    import repositories
    monkeypatch.setattr(repositories, 'ARTIFACT_ROOT', tmp_path)
    class FailingRepository(JobRepository):
        def put(self, job):
            if job.status == 'error':
                raise RuntimeError('Bearer PRIVATE_PERSISTENCE_TOKEN')
            super().put(job)
    async def fail(*args):
        raise RuntimeError('PRIVATE_RENDER_TOKEN')
    service = ExportService(jobs=FailingRepository(), artifacts=ArtifactRepository(), renderers=SimpleNamespace(resolve=lambda fmt: SimpleNamespace(render=fail)))
    async def execute():
        job, _ = service.create(ExportSubmission(scene=scene_payload(), request=request_payload('scene-json')), user_id='u', brand_id='b')
        await asyncio.gather(*service._tasks, return_exceptions=True)
        await asyncio.sleep(0)
        return job.id
    job_id = asyncio.run(execute())
    records = [json.loads(r.message) for r in caplog.records if r.name == 'canva.diagnostics']
    assert any(record['event'] == 'background_job_failed' and record['job_id'] == job_id for record in records)
    assert 'PRIVATE_PERSISTENCE_TOKEN' not in caplog.text
    assert 'PRIVATE_RENDER_TOKEN' not in caplog.text
