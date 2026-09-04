/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';

const model = {
  model_id: 'pump-failure', name: 'Pump Failure Predictor', owner: 'Reliability', framework: 'scikit-learn',
  versions: [{ version: '1.0.0', stage: 'DRAFT', approved: false, artifact_uri: 'file:///models/pump/1.0.0' }]
};

const metrics = [{
  timestamp: '2026-09-04T10:00:00Z', latency_ms: 42, throughput_rpm: 120, error_rate: 0.01,
  quality_score: 0.94, drift_score: 0.03, availability: 0.999, last_successful_inference: '2026-09-04T09:59:00Z', monitoring_status: 'HEALTHY'
}];

const deployment = (status: 'FAILED' | 'SUCCEEDED', environment: 'staging' | 'production') => ({
  deployment_id: `${environment}-${status.toLowerCase()}`, model_id: 'pump-failure', version: '1.0.0', environment,
  status, simulate_failure: status === 'FAILED', created_at: '2026-09-04T10:00:00Z', updated_at: '2026-09-04T10:00:00Z', events: []
});

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    component.deployments$ = of([]);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushInitialRequests(models: unknown[] = []): void {
    fixture.detectChanges();
    http.match(request => request.urlWithParams.startsWith('http://localhost:8000/models')).forEach(request => request.flush(models));
    http.match(request => request.urlWithParams.startsWith('http://localhost:8000/deployments')).forEach(request => request.flush([]));
    fixture.detectChanges();
  }

  function selectModelAndFlushDetails(selectedModel = model): void {
    flushInitialRequests([selectedModel]);
    const modelCard = fixture.nativeElement.querySelector('.model') as HTMLElement;
    modelCard.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    http.expectOne('http://localhost:8000/models/pump-failure/metrics').flush(metrics);
    http.expectOne('http://localhost:8000/deployments?model_id=pump-failure').flush([]);
    fixture.detectChanges();
  }

  function flushOperationRefreshes(): void {
    http.match(request => request.method === 'GET').forEach(request => {
      if (request.request.url.endsWith('/deployments') || request.request.url.includes('/deployments?')) request.flush([]);
      else if (request.request.url.endsWith('/models')) request.flush([model]);
      else if (request.request.url.includes('/models/')) request.flush(model);
    });
  }

  it('renders the initial model inventory', () => {
    flushInitialRequests([model]);
    expect(fixture.nativeElement.textContent).toContain('Pump Failure Predictor');
    expect(fixture.nativeElement.textContent).toContain('pump-failure');
    expect(fixture.nativeElement.textContent).toContain('1 versions');
  });

  it('selects a model and renders monitoring metrics', () => {
    selectModelAndFlushDetails();
    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Pump Failure Predictor');
    expect(content).toContain('42 ms');
    expect(content).toContain('120');
    expect(content).toContain('94%');
    expect(content).toContain('Availability');
  });

  it('renders the empty inventory state', () => {
    flushInitialRequests();
    expect(fixture.nativeElement.textContent).toContain('Inventory');
    expect(fixture.nativeElement.textContent).toContain('No models match this search.');
  });

  it('shows an API failure instead of an empty inventory', () => {
    fixture.detectChanges();
    const requests = http.match(request => request.urlWithParams.startsWith('http://localhost:8000/models'));
    requests.forEach((request, index) => index === 0
      ? request.flush({ detail: { message: 'offline' } }, { status: 503, statusText: 'Unavailable' })
      : request.flush([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Model inventory is unavailable');
  });

  it('registers a model and refreshes the inventory', () => {
    flushInitialRequests();
    component.modelForm = { model_id: 'new-model', name: 'New model', owner: 'Team', framework: 'sklearn' };
    component.registerModel();
    const create = http.expectOne('http://localhost:8000/models');
    expect(create.request.method).toBe('POST');
    create.flush({ model_id: 'new-model' });
    http.match(request => request.urlWithParams.startsWith('http://localhost:8000/models')).forEach(request => request.flush([]));
    expect(component.successMessage).toBe('Model registered.');
  });

  it('shows a backend error after a failed registration', () => {
    flushInitialRequests();
    component.registerModel();
    http.expectOne('http://localhost:8000/models').flush(
      { detail: { message: 'Model ID already exists.' } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Model ID already exists.');
    expect(fixture.nativeElement.textContent).not.toContain('Model registered.');
  });

  it('exposes lifecycle approval actions and posts each transition', () => {
    selectModelAndFlushDetails();
    const validate = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.version-actions button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Validate')) as HTMLButtonElement;
    expect(validate).toBeTruthy();
    validate.click();
    const lifecycle = http.expectOne('http://localhost:8000/models/pump-failure/versions/1.0.0/lifecycle');
    expect(lifecycle.request.body).toEqual({ stage: 'VALIDATED' });
    lifecycle.flush({ ...model.versions[0], stage: 'VALIDATED' });
    http.match(request => request.method === 'GET' && request.url.endsWith('/models')).forEach(request => request.flush([model]));
    http.expectOne('http://localhost:8000/models/pump-failure').flush({ ...model, versions: [{ ...model.versions[0], stage: 'VALIDATED' }] });
    fixture.detectChanges();
    const approve = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.version-actions button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Approve')) as HTMLButtonElement;
    expect(approve).toBeTruthy();
    approve.click();
    const approval = http.expectOne('http://localhost:8000/models/pump-failure/versions/1.0.0/lifecycle');
    expect(approval.request.body).toEqual({ stage: 'APPROVED' });
    approval.flush({ ...model.versions[0], stage: 'APPROVED', approved: true });
    flushOperationRefreshes();
    expect(component.successMessage).toBe('Version moved to APPROVED.');
  });

  it('renders version comparison results', () => {
    const twoVersionModel = { ...model, versions: [model.versions[0], { ...model.versions[0], version: '2.0.0', artifact_uri: 'file:///models/pump/2.0.0' }] };
    selectModelAndFlushDetails(twoVersionModel);
    component.compareVersions();
    http.expectOne(request => request.urlWithParams.includes('/versions/compare')).flush({
      model_id: 'pump-failure', left: twoVersionModel.versions[0], right: twoVersionModel.versions[1], same_artifact: false
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Artifacts differ');
  });

  it('retries a failed deployment through its visible control', () => {
    flushInitialRequests([model]);
    component.deployments$ = of([deployment('FAILED', 'staging')]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.deployment') as HTMLElement).dispatchEvent(new Event('click'));
    fixture.detectChanges();
    http.expectOne('http://localhost:8000/deployments/staging-failed').flush(deployment('FAILED', 'staging'));
    fixture.detectChanges();
    const retry = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.actions button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Retry')) as HTMLButtonElement;
    retry.click();
    http.expectOne('http://localhost:8000/deployments/staging-failed/retry').flush(deployment('SUCCEEDED', 'staging'));
    flushOperationRefreshes();
    expect(component.successMessage).toBe('Deployment retried.');
  });

  it('rolls back a successful production deployment through its visible control', () => {
    flushInitialRequests([model]);
    component.deployments$ = of([deployment('SUCCEEDED', 'production')]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.deployment') as HTMLElement).dispatchEvent(new Event('click'));
    fixture.detectChanges();
    http.expectOne('http://localhost:8000/deployments/production-succeeded').flush(deployment('SUCCEEDED', 'production'));
    fixture.detectChanges();
    const rollback = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.actions button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Rollback')) as HTMLButtonElement;
    rollback.click();
    http.expectOne('http://localhost:8000/deployments/production-succeeded/rollback').flush(deployment('ROLLED_BACK' as 'SUCCEEDED', 'production'));
    flushOperationRefreshes();
    expect(component.successMessage).toBe('Deployment rolled back.');
  });
});
