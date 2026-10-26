"""Shared export resource limits for video and glTF sampling."""
import os

MAX_EXPORT_PIXELS = max(
    262_144,
    int(os.getenv("DEPTHPOP_MAX_EXPORT_PIXELS", "16777216")),
)
MAX_EXPORT_FRAMES = max(
    1,
    int(os.getenv("DEPTHPOP_MAX_EXPORT_FRAMES", "3600")),
)
MAX_EXPORT_DURATION_MS = max(
    1000,
    int(os.getenv("DEPTHPOP_MAX_EXPORT_DURATION_MS", "120000")),
)


