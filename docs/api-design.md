# API Design

Interactive documentation is available at `http://localhost:8000/docs`.

## Resources

- `POST /models`, `GET /models`, `GET /models/{model_id}`
- `POST /models/{model_id}/versions`, `GET /models/{model_id}/versions`
- `GET /models/{model_id}/versions/compare?left=1.0.0&right=2.0.0`
- `POST /models/{model_id}/versions/{version}/lifecycle`
- `POST /deployments`, `GET /deployments`, `GET /deployments/{deployment_id}`
- `POST /deployments/{deployment_id}/retry`
- `POST /deployments/{deployment_id}/rollback`
- `GET /models/{model_id}/metrics`
- `GET /health`

Deployment creation accepts `X-Idempotency-Key`. Reusing a key with the same payload returns the original deployment; changing the payload returns `409 IDEMPOTENCY_CONFLICT`.

Errors use `{"detail":{"code":"...","message":"..."}}`; validation errors include field details.
