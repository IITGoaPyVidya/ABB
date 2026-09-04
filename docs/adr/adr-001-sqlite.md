# ADR-001: SQLite For The Assignment Runtime

## Status

Accepted

## Context

The assignment requires persistent state and a runnable local/demo package without infrastructure overhead.

## Decision

Use Python's SQLite driver with explicit schema creation at API startup and a mounted database volume in Docker Compose.

## Consequences

This gives deterministic local persistence and simple inspection. SQLite is not intended for high-concurrency production workloads; PostgreSQL with migrations is a future evolution.
