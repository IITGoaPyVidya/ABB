# Angular UI Test Scenarios

This guide verifies the main MLOps workflow through the Angular UI.

## Prerequisites

Start the application from the repository root:

```powershell
docker compose down -v
docker compose up --build
```

Open:

- UI: http://localhost:4200
- API documentation: http://localhost:8000/docs
- API health check: http://localhost:8000/health

Wait until the UI shows the seeded models and the health check returns `{"status":"ok","database":"sqlite"}`.

## Test Data

Use a new model ID for each clean run:

- Model ID: `ui-demo-model`
- Name: `UI Demo Predictor`
- Owner: `ML Platform`
- Framework: `scikit-learn`
- Version: `1.0.0`
- Artifact URI: `file:///models/ui-demo/1.0.0`
- Training data reference: `dataset-ui-v1`

## Scenario 1: Register A Model

1. Scroll to **Release workflow**.
2. In **Register model**, enter the test model values.
3. Click **Register model**.

Expected result:

- A success message confirms registration.
- The model appears in **Inventory**.
- The model count increases by one.

## Scenario 2: Register A Version

1. Click `UI Demo Predictor` in **Inventory**.
2. In **Add version**, enter the version, artifact URI, and training data reference.
3. Click **Add version**.

Expected result:

- Version `1.0.0` appears.
- Its initial stage is `DRAFT`.
- It is marked as awaiting approval.

## Scenario 3: Block Unapproved Production Deployment

1. In **Request deployment**, select `UI Demo Predictor`.
2. Enter version `1.0.0` and select **Production**.
3. Ensure **Simulate failure** is unchecked.
4. Click **Deploy**.

Expected result:

- The request is rejected.
- A visible error explains that approval is required.
- No successful production deployment is created.

## Scenario 4: Validate And Approve A Version

1. In the `1.0.0` version card, click **Validate**.
2. Check that the stage changes to `VALIDATED`.
3. Click **Approve**.
4. Check that the stage changes to `APPROVED`.

Expected result:

- Lifecycle stages change in order.
- The version is shown as approved for release.
- Invalid lifecycle actions are not shown for the current stage.

## Scenario 5: Deploy An Approved Version

1. In **Request deployment**, select the model, version `1.0.0`, and **Production**.
2. Ensure **Simulate failure** is unchecked.
3. Click **Deploy**.
4. Select the new deployment in **Deployments**.

Expected result:

- Status is `SUCCEEDED`.
- Event `deployment_completed` is visible.
- Model, version, and environment are correct.

## Scenario 6: Verify Deployment Idempotency

Verify duplicate safety using the same idempotency key through the API documentation if the UI does not expose a reusable key.

Expected result:

- An identical request with the same key returns the existing deployment.
- Reusing the key with a different payload returns a conflict.
- Separate UI deployment actions create separate deployments.

## Scenario 7: Roll Back A Production Deployment

1. Select a successful production deployment.
2. Click **Rollback** in the deployment details.

Expected result:

- Status changes to `ROLLED_BACK`.
- Event `deployment_rolled_back` is visible.
- **Rollback** is no longer available for that deployment.

## Scenario 8: Simulate A Failed Deployment

1. Request a **Staging** deployment for `UI Demo Predictor` version `1.0.0`.
2. Check **Simulate failure**.
3. Click **Deploy** and select the new deployment.

Expected result:

- Status is `FAILED`.
- Event `deployment_failed` is visible.
- **Retry** is available.

## Scenario 9: Retry A Failed Deployment

1. Select the failed deployment.
2. Click **Retry**.

Expected result:

- Status changes to `SUCCEEDED`.
- Event `deployment_retried` is visible.
- **Retry** is no longer available.

## Scenario 10: View Monitoring Metrics

1. Click the seeded model `Pump Failure Predictor`.
2. Click **Refresh metrics**.
3. Review **Monitoring snapshot**.

Expected result:

Values appear for latency, throughput, error rate, quality, drift, availability, last successful inference, and monitoring status.

## Scenario 11: Compare Two Model Versions

1. Select a model with at least two versions.
2. Choose two different versions in the comparison controls.
3. Review the comparison.

Expected result:

- Both versions are shown side by side.
- Lifecycle stage and approval status are visible.
- Artifact URI and training-data reference are distinguishable.
- Version-specific metrics are not mixed together.

## Scenario 12: Search And Filter Inventory

1. In **Search inventory**, type `pump`.
2. Confirm that only `Pump Failure Predictor` remains.
3. Clear the search field.
4. Select a model and inspect its versions and metrics.

Expected result:

- Search results update without a full-page reload.
- Clearing the field restores the inventory.
- Selecting a model updates the detail sections.

## Scenario 13: Verify Deployment History And Events

1. Scroll to **Deployments**.
2. Click `dep-1001` or another deployment.
3. Review its details and event list.
4. Select a different deployment.

Expected result:

- Deployment ID, model, version, environment, and status are visible.
- Events show timestamps, names, and statuses.
- Selecting another deployment updates the detail panel.

## Scenario 14: Verify Loading, Empty, And Error States

### Loading state

1. Reload the page with browser developer tools network throttling enabled.

Expected result: loading text appears while data is requested.

### Empty state

1. Search for `does-not-exist`.

Expected result: `No models match this search.` appears and the page remains usable.

### Error state

1. Stop the backend:

```powershell
docker compose stop backend
```

2. Refresh the UI or submit an operation.

Expected result: a clear API or network error appears and the action is not reported as successful.

3. Restart the backend:

```powershell
docker compose start backend
```

## Scenario 15: Verify Responsive Layout

1. Open browser developer tools.
2. Test desktop and mobile viewports, including approximately 375px wide.
3. Scroll through operations, metrics, and deployments.

Expected result:

- Forms stack without horizontal clipping.
- Buttons remain usable.
- Metrics and events remain readable.
- Important content does not overlap.

## Scenario 16: Reset Test Data

Restore the original seeded state:

```powershell
docker compose down -v
docker compose up --build
```

## Test Evidence Checklist

Capture screenshots or notes for:

- Model registration success
- Version approval
- Rejected unapproved production deployment
- Successful production deployment
- Rollback event
- Failed deployment and retry
- Monitoring metrics
- Version comparison
- Error state
- Responsive mobile view
