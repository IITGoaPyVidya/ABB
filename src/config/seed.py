"""Load the supplied registry, deployment events, and metrics into SQLite."""
from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path


def seed(database: Path, artifacts: Path) -> None:
    try:
        from backend.app import Store
    except ModuleNotFoundError:
        from app import Store

    store = Store(database)
    store.init()
    registry = json.loads((artifacts / "sample_model_registry.json").read_text())
    events = json.loads((artifacts / "sample_deployment_events.json").read_text())
    with store.connect() as db:
        if db.execute("SELECT 1 FROM models LIMIT 1").fetchone():
            return
        for model in registry:
            timestamp = model.get("created_at", "2026-01-01T00:00:00+00:00")
            db.execute("INSERT OR IGNORE INTO models VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (model["model_id"], model["name"], model["owner"], model["framework"], None, json.dumps([]), json.dumps({}), timestamp, timestamp))
            for version in model["versions"]:
                db.execute("INSERT OR IGNORE INTO versions VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (model["model_id"], version["version"], version["artifact_uri"], None, version["stage"], int(version["approved"]), timestamp, timestamp))
        for event in events:
            related_version = db.execute("SELECT 1 FROM versions WHERE model_id = ? AND version = ?", (event["model_id"], event["version"])).fetchone()
            if not related_version:
                continue
            db.execute("INSERT OR IGNORE INTO deployments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (event["deployment_id"], event["model_id"], event["version"], event["environment"], event["status"], 0, None, event["timestamp"], event["timestamp"]))
            db.execute("INSERT INTO events (deployment_id, event, status, timestamp) VALUES (?, ?, ?, ?)", (event["deployment_id"], event["event"], event["status"], event["timestamp"]))
        for metric in csv.DictReader((artifacts / "sample_model_metrics.csv").read_text().splitlines()):
            db.execute("INSERT INTO metrics (model_id, version, environment, timestamp, latency_ms, throughput_rpm, error_rate, quality_score, drift_score, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (metric["model_id"], metric["version"], metric["environment"], metric["timestamp"], *(float(metric[key]) for key in ("latency_ms", "throughput_rpm", "error_rate", "quality_score", "drift_score", "availability"))))


if __name__ == "__main__":
    root = Path(__file__).parents[2]
    seed(Path("mlops.db"), root / "artifacts")
