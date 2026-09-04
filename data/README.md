# Data

Runtime SQLite data is stored in the Docker volume managed by `docker-compose.yml` and is intentionally not committed.

The deterministic sample inputs used for seeding remain in [`../artifacts/`](../artifacts/): registry records, deployment events, metrics, and the seed OpenAPI contract.
