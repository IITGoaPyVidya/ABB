# ADR-001: SQLite for the Assignment Runtime

## Status
Accepted

## Context
The assignment needs persistent state and a runnable local/demo package without infrastructure overhead.

## Decision
Use Python's SQLite driver with explicit schema creation at API startup and a mounted database volume in Compose.

## Consequences
This gives deterministic local persistence and simple inspection. SQLite is not the target for high-concurrency production workloads; PostgreSQL and migrations would be the next deployment evolution.
