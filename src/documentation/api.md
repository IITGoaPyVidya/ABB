# API Quick Reference

Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

- `POST /models`, `GET /models`, `GET /models/{model_id}`
- `POST /models/{model_id}/versions`, `GET /models/{model_id}/versions`
- `GET /models/{model_id}/versions/compare?left=1.0.0&right=2.0.0` returns both version records and whether their artifacts match.
- `POST /models/{model_id}/versions/{version}/lifecycle` with `{"stage":"VALIDATED|APPROVED|STAGING|PRODUCTION|ARCHIVED"}`
- `POST /deployments` with `X-Idempotency-Key`; `GET /deployments` and `GET /deployments/{deployment_id}`
- `POST /deployments/{deployment_id}/retry` and `/rollback`
- `GET /models/{model_id}/metrics`
- `GET /health`

Metrics include latency, throughput, error rate, quality, drift, availability, `last_successful_inference`, and `monitoring_status` (`HEALTHY` or `DEGRADED`). Errors use HTTP-appropriate status codes with `{"detail":{"code":"...","message":"..."}}`; validation uses `VALIDATION_ERROR` with field details. Reusing an idempotency key with a different payload returns `409 IDEMPOTENCY_CONFLICT`.
