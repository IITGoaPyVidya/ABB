from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mlops.db")
DB_PATH = Path(DATABASE_URL.removeprefix("sqlite:///")).resolve()
LOCAL_ARTIFACTS_PATH = Path(__file__).resolve().parent / "artifacts"
if not LOCAL_ARTIFACTS_PATH.exists() and len(Path(__file__).resolve().parents) > 2:
    LOCAL_ARTIFACTS_PATH = Path(__file__).resolve().parents[2] / "artifacts"
ARTIFACTS_PATH = Path(os.getenv("ARTIFACTS_PATH", str(LOCAL_ARTIFACTS_PATH)))


class Lifecycle(str, Enum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    APPROVED = "APPROVED"
    STAGING = "STAGING"
    PRODUCTION = "PRODUCTION"
    ARCHIVED = "ARCHIVED"


class DeploymentStatus(str, Enum):
    REQUESTED = "REQUESTED"
    VALIDATING = "VALIDATING"
    DEPLOYING = "DEPLOYING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


ALLOWED_TRANSITIONS = {
    Lifecycle.DRAFT: {Lifecycle.VALIDATED},
    Lifecycle.VALIDATED: {Lifecycle.APPROVED, Lifecycle.DRAFT},
    Lifecycle.APPROVED: {Lifecycle.STAGING, Lifecycle.ARCHIVED},
    Lifecycle.STAGING: {Lifecycle.PRODUCTION, Lifecycle.ARCHIVED},
    Lifecycle.PRODUCTION: {Lifecycle.ARCHIVED},
    Lifecycle.ARCHIVED: set(),
}


class ModelCreate(BaseModel):
    model_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")
    name: str = Field(min_length=1, max_length=120)
    owner: str = Field(min_length=1, max_length=120)
    framework: str = Field(min_length=1, max_length=80)
    algorithm: str | None = None
    tags: list[str] = []
    metadata: dict[str, Any] = {}


class VersionCreate(BaseModel):
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    artifact_uri: str = Field(min_length=1)
    training_data_ref: str | None = None


class LifecycleChange(BaseModel):
    stage: Lifecycle


class DeploymentCreate(BaseModel):
    model_id: str
    version: str
    environment: str = Field(pattern=r"^(staging|production)$")
    simulate_failure: bool = False


class ModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    model_id: str
    name: str
    owner: str
    framework: str
    algorithm: str | None
    tags: list[str]
    metadata: dict[str, Any]
    created_at: str
    updated_at: str
    versions: list[dict[str, Any]] = []


class Store:
    def __init__(self, path: Path):
        self.path = path

    def connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def init(self) -> None:
        with self.connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS models (
                    model_id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL,
                    framework TEXT NOT NULL, algorithm TEXT, tags TEXT NOT NULL,
                    metadata TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS versions (
                    model_id TEXT NOT NULL, version TEXT NOT NULL, artifact_uri TEXT NOT NULL,
                    training_data_ref TEXT, stage TEXT NOT NULL, approved INTEGER NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    PRIMARY KEY (model_id, version), FOREIGN KEY (model_id) REFERENCES models(model_id)
                );
                CREATE TABLE IF NOT EXISTS deployments (
                    deployment_id TEXT PRIMARY KEY, model_id TEXT NOT NULL, version TEXT NOT NULL,
                    environment TEXT NOT NULL, status TEXT NOT NULL, simulate_failure INTEGER NOT NULL,
                    idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    FOREIGN KEY (model_id, version) REFERENCES versions(model_id, version)
                );
                CREATE TABLE IF NOT EXISTS events (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT, deployment_id TEXT NOT NULL,
                    event TEXT NOT NULL, status TEXT NOT NULL, timestamp TEXT NOT NULL,
                    FOREIGN KEY (deployment_id) REFERENCES deployments(deployment_id)
                );
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, model_id TEXT NOT NULL, version TEXT NOT NULL,
                    environment TEXT NOT NULL, timestamp TEXT NOT NULL, latency_ms REAL NOT NULL,
                    throughput_rpm REAL NOT NULL, error_rate REAL NOT NULL, quality_score REAL NOT NULL,
                    drift_score REAL NOT NULL, availability REAL NOT NULL
                );
                """
            )


store = Store(DB_PATH)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def error(code: str, message: str, http_status: int) -> HTTPException:
    return HTTPException(http_status, detail={"code": code, "message": message})


def version_dict(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["approved"] = bool(result["approved"])
    return result


def get_version(db: sqlite3.Connection, model_id: str, version: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM versions WHERE model_id = ? AND version = ?", (model_id, version)).fetchone()
    if not row:
        raise error("VERSION_NOT_FOUND", "Model version was not found", 404)
    return row


def log_event(db: sqlite3.Connection, deployment_id: str, event: str, deployment_status: str) -> None:
    db.execute("INSERT INTO events (deployment_id, event, status, timestamp) VALUES (?, ?, ?, ?)", (deployment_id, event, deployment_status, now()))


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.init()
    if os.getenv("SEED_DATA", "false").lower() == "true":
        from config.seed import seed

        seed(DB_PATH, ARTIFACTS_PATH)
    yield


app = FastAPI(title="MLOps Platform", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": "sqlite"}


@app.post("/models", status_code=status.HTTP_201_CREATED)
def create_model(payload: ModelCreate) -> dict[str, Any]:
    timestamp = now()
    try:
        with store.connect() as db:
            db.execute("INSERT INTO models VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (payload.model_id, payload.name, payload.owner, payload.framework, payload.algorithm, json.dumps(payload.tags), json.dumps(payload.metadata), timestamp, timestamp))
            return {**payload.model_dump(), "created_at": timestamp, "updated_at": timestamp, "versions": []}
    except sqlite3.IntegrityError:
        raise error("MODEL_EXISTS", "Model ID already exists", 409)


@app.get("/models")
def list_models(search: str | None = Query(default=None)) -> list[dict[str, Any]]:
    with store.connect() as db:
        rows = db.execute("SELECT * FROM models WHERE name LIKE ? OR model_id LIKE ? ORDER BY name", (f"%{search or ''}%", f"%{search or ''}%")).fetchall()
        return [_model_response(db, row) for row in rows]


def _model_response(db: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["tags"] = json.loads(result["tags"])
    result["metadata"] = json.loads(result["metadata"])
    result["versions"] = [version_dict(version) for version in db.execute("SELECT * FROM versions WHERE model_id = ? ORDER BY version", (row["model_id"],)).fetchall()]
    return result


@app.get("/models/{model_id}")
def get_model(model_id: str) -> dict[str, Any]:
    with store.connect() as db:
        row = db.execute("SELECT * FROM models WHERE model_id = ?", (model_id,)).fetchone()
        if not row:
            raise error("MODEL_NOT_FOUND", "Model was not found", 404)
        return _model_response(db, row)


@app.post("/models/{model_id}/versions", status_code=status.HTTP_201_CREATED)
def create_version(model_id: str, payload: VersionCreate) -> dict[str, Any]:
    timestamp = now()
    try:
        with store.connect() as db:
            if not db.execute("SELECT 1 FROM models WHERE model_id = ?", (model_id,)).fetchone():
                raise error("MODEL_NOT_FOUND", "Model was not found", 404)
            db.execute("INSERT INTO versions VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (model_id, payload.version, payload.artifact_uri, payload.training_data_ref, Lifecycle.DRAFT, 0, timestamp, timestamp))
            return {"model_id": model_id, **payload.model_dump(), "stage": Lifecycle.DRAFT, "approved": False, "created_at": timestamp, "updated_at": timestamp}
    except sqlite3.IntegrityError:
        raise error("VERSION_EXISTS", "Model version already exists", 409)


@app.get("/models/{model_id}/versions")
def list_versions(model_id: str) -> list[dict[str, Any]]:
    with store.connect() as db:
        if not db.execute("SELECT 1 FROM models WHERE model_id = ?", (model_id,)).fetchone():
            raise error("MODEL_NOT_FOUND", "Model was not found", 404)
        return [version_dict(row) for row in db.execute("SELECT * FROM versions WHERE model_id = ? ORDER BY version", (model_id,)).fetchall()]


@app.post("/models/{model_id}/versions/{version}/lifecycle")
def change_lifecycle(model_id: str, version: str, payload: LifecycleChange) -> dict[str, Any]:
    with store.connect() as db:
        current = get_version(db, model_id, version)
        target = payload.stage
        if target not in ALLOWED_TRANSITIONS[Lifecycle(current["stage"])]:
            raise error("INVALID_LIFECYCLE_TRANSITION", f"Cannot move {current['stage']} to {target}", 409)
        approved = 1 if target in {Lifecycle.APPROVED, Lifecycle.STAGING, Lifecycle.PRODUCTION} else current["approved"]
        timestamp = now()
        db.execute("UPDATE versions SET stage = ?, approved = ?, updated_at = ? WHERE model_id = ? AND version = ?", (target, approved, timestamp, model_id, version))
        return version_dict(get_version(db, model_id, version))


@app.post("/deployments", status_code=status.HTTP_202_ACCEPTED)
def create_deployment(payload: DeploymentCreate, x_idempotency_key: str | None = Header(default=None)) -> dict[str, Any]:
    with store.connect() as db:
        if x_idempotency_key:
            existing = db.execute("SELECT * FROM deployments WHERE idempotency_key = ?", (x_idempotency_key,)).fetchone()
            if existing:
                return deployment_response(db, existing)
        version = get_version(db, payload.model_id, payload.version)
        if payload.environment == "production" and (not version["approved"] or version["stage"] not in {Lifecycle.APPROVED, Lifecycle.STAGING, Lifecycle.PRODUCTION}):
            raise error("APPROVAL_REQUIRED", "Only approved versions can deploy to production", 422)
        deployment_id, timestamp = f"dep-{uuid.uuid4().hex[:10]}", now()
        deployment_status = DeploymentStatus.FAILED if payload.simulate_failure else DeploymentStatus.SUCCEEDED
        db.execute("INSERT INTO deployments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (deployment_id, payload.model_id, payload.version, payload.environment, deployment_status, int(payload.simulate_failure), x_idempotency_key, timestamp, timestamp))
        log_event(db, deployment_id, "deployment_failed" if payload.simulate_failure else "deployment_completed", deployment_status)
        return deployment_response(db, db.execute("SELECT * FROM deployments WHERE deployment_id = ?", (deployment_id,)).fetchone())


def deployment_response(db: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["simulate_failure"] = bool(result["simulate_failure"])
    result["events"] = [dict(event) for event in db.execute("SELECT * FROM events WHERE deployment_id = ? ORDER BY event_id", (row["deployment_id"],)).fetchall()]
    return result


@app.get("/deployments")
def list_deployments(model_id: str | None = None) -> list[dict[str, Any]]:
    with store.connect() as db:
        rows = db.execute("SELECT * FROM deployments WHERE (? IS NULL OR model_id = ?) ORDER BY created_at DESC", (model_id, model_id)).fetchall()
        return [deployment_response(db, row) for row in rows]


@app.get("/deployments/{deployment_id}")
def get_deployment(deployment_id: str) -> dict[str, Any]:
    with store.connect() as db:
        row = db.execute("SELECT * FROM deployments WHERE deployment_id = ?", (deployment_id,)).fetchone()
        if not row:
            raise error("DEPLOYMENT_NOT_FOUND", "Deployment was not found", 404)
        return deployment_response(db, row)


@app.post("/deployments/{deployment_id}/retry", status_code=status.HTTP_202_ACCEPTED)
def retry_deployment(deployment_id: str) -> dict[str, Any]:
    with store.connect() as db:
        row = db.execute("SELECT * FROM deployments WHERE deployment_id = ?", (deployment_id,)).fetchone()
        if not row:
            raise error("DEPLOYMENT_NOT_FOUND", "Deployment was not found", 404)
        if row["status"] != DeploymentStatus.FAILED:
            raise error("INVALID_DEPLOYMENT_STATE", "Only failed deployments can be retried", 409)
        timestamp = now()
        db.execute("UPDATE deployments SET status = ?, simulate_failure = 0, updated_at = ? WHERE deployment_id = ?", (DeploymentStatus.SUCCEEDED, timestamp, deployment_id))
        log_event(db, deployment_id, "deployment_retried", DeploymentStatus.SUCCEEDED)
        return deployment_response(db, db.execute("SELECT * FROM deployments WHERE deployment_id = ?", (deployment_id,)).fetchone())


@app.post("/deployments/{deployment_id}/rollback")
def rollback_deployment(deployment_id: str) -> dict[str, Any]:
    with store.connect() as db:
        row = db.execute("SELECT * FROM deployments WHERE deployment_id = ?", (deployment_id,)).fetchone()
        if not row:
            raise error("DEPLOYMENT_NOT_FOUND", "Deployment was not found", 404)
        if row["status"] != DeploymentStatus.SUCCEEDED or row["environment"] != "production":
            raise error("INVALID_DEPLOYMENT_STATE", "Only successful production deployments can be rolled back", 409)
        db.execute("UPDATE deployments SET status = ?, updated_at = ? WHERE deployment_id = ?", (DeploymentStatus.ROLLED_BACK, now(), deployment_id))
        log_event(db, deployment_id, "deployment_rolled_back", DeploymentStatus.ROLLED_BACK)
        return deployment_response(db, db.execute("SELECT * FROM deployments WHERE deployment_id = ?", (deployment_id,)).fetchone())


@app.get("/models/{model_id}/metrics")
def model_metrics(model_id: str, version: str | None = None, environment: str | None = None) -> list[dict[str, Any]]:
    with store.connect() as db:
        rows = db.execute("SELECT * FROM metrics WHERE model_id = ? AND (? IS NULL OR version = ?) AND (? IS NULL OR environment = ?) ORDER BY timestamp DESC", (model_id, version, version, environment, environment)).fetchall()
        return [dict(row) for row in rows]
