# Known Limitations

- Deployment is synchronous and simulated; no real model serving runtime is called.
- SQLite is suitable for this local assignment but not multi-instance production concurrency.
- Authentication, authorization, and audit identity are not implemented.
- There is no external queue, worker, Kubernetes integration, or cloud artifact store.
- Rollback records the deployment rollback state and event; a real serving adapter would restore traffic to a prior version.
- Monitoring data is deterministic sample data rather than live inference telemetry.
- Browser end-to-end automation is not included; Angular component and HTTP tests are included.
