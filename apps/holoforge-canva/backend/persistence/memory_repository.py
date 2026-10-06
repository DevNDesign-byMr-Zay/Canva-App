from __future__ import annotations

import time
from repositories import ArtifactRepository, JobRepository, OwnedKey, _remove_artifact_tree
from models import ExportArtifact, ExportJob


class MemoryJobRepository(JobRepository):
    def recover_stale_jobs(self) -> int:
        with self._lock:
            stale_count = 0
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            for key, (created, job) in list(self._values.items()):
                if job.status in {"queued", "rendering", "validating", "packaging"}:
                    stale_count += 1
                    updated = job.model_copy(
                        update={
                            "status": "error",
                            "stage": "error",
                            "error": "Server restarted while render was processing",
                            "updatedAt": now_iso,
                        }
                    )
                    self._values[key] = (created, updated)
            return stale_count


class MemoryArtifactRepository(ArtifactRepository):
    pass
