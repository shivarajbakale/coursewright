"""Tests run with no network and no API keys, against a throwaway SQLite file."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="cw-test-"))
os.environ["CW_DB_PATH"] = str(_TMP / "test.db")
os.environ["CW_DISABLE_WORKER"] = "1"
for _k in ("ANTHROPIC_API_KEY", "VOYAGE_API_KEY", "GITHUB_TOKEN"):
    os.environ.pop(_k, None)
    os.environ[_k] = ""  # also shadows agent/.env

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:  # runs lifespan: migrate, seed, index
        yield c


@pytest.fixture(scope="session")
def course(client):
    courses = client.get("/api/courses").json()["data"]
    raft = next(c for c in courses if "Raft" in c["title"])
    return client.get(f"/api/courses/{raft['id']}").json()["data"]


def drain():
    import asyncio

    from app.jobs.worker import drain as _drain

    return asyncio.run(_drain())
