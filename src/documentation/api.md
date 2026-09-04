# API Quick Reference

Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

- `POST /models`, `GET /models`, `GET /models/{model_id}`
- `POST /models/{model_id}/versions`, `GET /models/{model_id}/versions`
- `POST /models/{model_id}/versions/{version}/lifecycle` with `{"stage":"VALIDATED|APPROVED|STAGING|PRODUCTION|ARCHIVED"}`
- `POST /deployments` with `X-Idempotency-Key`; `GET /deployments` and `GET /deployments/{deployment_id}`
- `POST /deployments/{deployment_id}/retry` and `/rollback`
- `GET /models/{model_id}/metrics`
- `GET /health`

Errors use HTTP-appropriate status codes with `{"detail":{"code":"...","message":"..."}}`.
