"""Runtime settings, read from the environment on every access so tests can override them."""

from __future__ import annotations

import os
from pathlib import Path

VERSION = "0.1.0"

AGENT_DIR = Path(__file__).resolve().parent.parent
APP_DIR = AGENT_DIR / "app"
PROMPTS_DIR = APP_DIR / "prompts"

MODEL = "claude-opus-5-5"
EMBED_DIMS = 1024
VOYAGE_EMBED_MODEL = "voyage-3.5"
VOYAGE_RERANK_MODEL = "rerank-2.5"
LOCAL_EMBED_MODEL = "local-hash-1024"

# Load agent/.env if present (no python-dotenv dependency needed).
_env_file = AGENT_DIR / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _v = _line.split("=", 1)
        os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))


def db_path() -> Path:
    return Path(os.environ.get("CW_DB_PATH") or (AGENT_DIR / "data" / "coursewright.db"))


def data_dir() -> Path:
    return db_path().parent


def jobs_dir() -> Path:
    return data_dir() / "jobs"


def anthropic_key() -> str | None:
    return os.environ.get("ANTHROPIC_API_KEY") or None


def voyage_key() -> str | None:
    return os.environ.get("VOYAGE_API_KEY") or None


def github_token() -> str | None:
    return os.environ.get("GITHUB_TOKEN") or None


def worker_enabled() -> bool:
    return os.environ.get("CW_DISABLE_WORKER", "") not in ("1", "true", "yes")


def build_token_budget() -> int:
    return int(os.environ.get("CW_BUILD_TOKEN_BUDGET", "4000000"))


def embed_model() -> str:
    return VOYAGE_EMBED_MODEL if voyage_key() else LOCAL_EMBED_MODEL


def embedder_kind() -> str:
    return "voyage" if voyage_key() else "local"


def prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text()
