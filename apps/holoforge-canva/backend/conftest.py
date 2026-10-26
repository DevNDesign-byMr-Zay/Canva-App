"""Routine pytest is isolated; the authorized live smoke runs its own CLI."""
import importlib.util
import socket

import pytest


@pytest.fixture(autouse=True)
def isolated_backend_test(monkeypatch):
    for key in ['FAL_KEY', 'FAL', 'FAL_API_KEY', 'DEPTHPOP_LIVE_PROVIDER_SMOKE']:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv('ENVIRONMENT', 'test')
    original_connect = socket.socket.connect
    def connect(sock, address):
        if sock.family in (socket.AF_INET, socket.AF_INET6):
            raise AssertionError('Unexpected outbound network in isolated backend tests')
        return original_connect(sock, address)
    def blocked(*args, **kwargs):
        raise AssertionError('Unexpected outbound network/provider call in isolated backend tests')
    monkeypatch.setattr(socket.socket, 'connect', connect)
    monkeypatch.setattr(socket.socket, 'connect_ex', blocked)
    monkeypatch.setattr(socket, 'create_connection', blocked)
    monkeypatch.setattr(socket, 'getaddrinfo', blocked)
    if importlib.util.find_spec('fal_client') is not None:
        import fal_client
        for name in ['run', 'run_async', 'subscribe', 'subscribe_async', 'submit', 'submit_async', 'upload', 'upload_async', 'upload_file', 'upload_file_async']:
            if hasattr(fal_client, name):
                monkeypatch.setattr(fal_client, name, blocked)
