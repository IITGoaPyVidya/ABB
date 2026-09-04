import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

type Lifecycle = 'DRAFT' | 'VALIDATED' | 'APPROVED' | 'STAGING' | 'PRODUCTION' | 'ARCHIVED';
type Environment = 'staging' | 'production';
type DeploymentStatus = 'REQUESTED' | 'VALIDATING' | 'DEPLOYING' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK';
interface Version { model_id?: string; version: string; stage: Lifecycle; approved: boolean; artifact_uri: string; training_data_ref?: string; }
interface Model { model_id: string; name: string; owner: string; framework: string; versions: Version[]; }
interface Metric { timestamp: string; latency_ms: number; throughput_rpm: number; error_rate: number; quality_score: number; drift_score: number; availability: number; last_successful_inference: string; monitoring_status: string; }
interface VersionComparison { model_id: string; left: Version; right: Version; same_artifact: boolean; }
interface DeploymentEvent { event_id: number; deployment_id: string; event: string; status: DeploymentStatus; timestamp: string; }
interface Deployment { deployment_id: string; model_id: string; version: string; environment: Environment; status: DeploymentStatus; simulate_failure: boolean; created_at: string; updated_at: string; events: DeploymentEvent[]; }
interface ModelCreate { model_id: string; name: string; owner: string; framework: string; }
interface VersionCreate { version: string; artifact_uri: string; training_data_ref?: string; }
interface DeploymentCreate { model_id: string; version: string; environment: Environment; simulate_failure: boolean; }

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule], template: `
<main><header><div><p class="eyebrow">MODEL OPERATIONS / G13</p><h1>Registry control room</h1><p class="subhead">Trace releases from validation to production health.</p></div><span class="status">● API connected</span></header>
<section class="toolbar"><label>Search inventory <input #query (input)="load(query.value)" placeholder="model name or ID"></label><span>{{ (models$ | async)?.length || 0 }} models tracked</span></section>
<section class="layout"><div class="inventory"><h2>Inventory</h2><p class="message error" *ngIf="modelLoadError">{{ modelLoadError }}</p><ng-container *ngIf="models$ | async as models; else loading"><article class="model" *ngFor="let model of models" (click)="select(model)" [class.selected]="selected?.model_id === model.model_id"><div><strong>{{ model.name }}</strong><small>{{ model.model_id }} · {{ model.framework }}</small></div><span>{{ model.versions.length }} versions</span></article><p class="empty" *ngIf="!models.length && !modelLoadError">No models match this search.</p></ng-container><ng-template #loading><p class="empty">Loading model inventory...</p></ng-template></div>
<div class="detail" *ngIf="selected as model; else choose"><div class="detail-head"><div><p class="eyebrow">SELECTED MODEL</p><h2>{{ model.name }}</h2><p>{{ model.owner }} · {{ model.framework }}</p></div><button (click)="loadMetrics(model.model_id)">Refresh metrics</button></div><h3>Versions</h3><div class="versions"><div class="version" *ngFor="let item of model.versions"><div><strong>v{{ item.version }}</strong><span class="pill" [class.production]="item.stage === 'PRODUCTION'">{{ item.stage }}</span></div><small>{{ item.approved ? 'Approved for release' : 'Awaiting approval' }}</small><div class="version-actions"><button *ngIf="canTransition(item, 'VALIDATED')" (click)="changeLifecycle(item, 'VALIDATED')">Validate</button><button *ngIf="canTransition(item, 'APPROVED')" (click)="changeLifecycle(item, 'APPROVED')">Approve</button><button *ngIf="canTransition(item, 'STAGING')" (click)="changeLifecycle(item, 'STAGING')">Promote to staging</button><button *ngIf="canTransition(item, 'PRODUCTION')" (click)="changeLifecycle(item, 'PRODUCTION')">Promote to production</button></div></div></div><div class="comparison"><h3>Compare versions</h3><select [(ngModel)]="comparisonLeft"><option *ngFor="let item of model.versions" [value]="item.version">v{{ item.version }}</option></select><select [(ngModel)]="comparisonRight"><option *ngFor="let item of model.versions" [value]="item.version">v{{ item.version }}</option></select><button (click)="compareVersions()" [disabled]="model.versions.length < 2">Compare</button><p *ngIf="comparison as result"><small>Artifacts {{ result.same_artifact ? 'match' : 'differ' }}: {{ result.left.artifact_uri }} vs {{ result.right.artifact_uri }}</small></p></div><h3>Monitoring snapshot</h3><ng-container *ngIf="metrics$ | async as metrics; else metricsLoading"><div class="metrics" *ngIf="metrics.length; else noMetrics"><div><b>{{ metrics[0].latency_ms | number:'1.0-0' }} ms</b><small>Latency</small></div><div><b>{{ metrics[0].throughput_rpm | number:'1.0-0' }}</b><small>Throughput / min</small></div><div><b>{{ metrics[0].error_rate | percent }}</b><small>Error rate</small></div><div><b>{{ metrics[0].drift_score | number:'1.2-2' }}</b><small>Drift score</small></div><div><b>{{ metrics[0].quality_score | percent }}</b><small>Quality</small></div><div><b>{{ metrics[0].availability | number:'1.2-2' }}%</b><small>Availability</small></div><div><b>{{ metrics[0].monitoring_status }}</b><small>Monitoring status</small></div><div><b>{{ metrics[0].last_successful_inference | date:'short' }}</b><small>Last successful inference</small></div></div><ng-template #noMetrics><p class="empty">No monitoring data for this model.</p></ng-template></ng-container><ng-template #metricsLoading><p class="empty">Select refresh to load metrics.</p></ng-template></div><ng-template #choose><div class="detail empty"><h2>Select a model</h2><p>Choose an inventory item to inspect versions and health.</p></div></ng-template></section>
<section class="operations"><div class="section-heading"><div><p class="eyebrow">OPERATIONS</p><h2>Release workflow</h2></div><span *ngIf="busy" class="muted">Working...</span></div><p *ngIf="successMessage" class="message success">{{ successMessage }}</p><p *ngIf="errorMessage" class="message error">{{ errorMessage }}</p><div class="operation-grid"><form (ngSubmit)="registerModel()"><h3>Register model</h3><label>Model ID<input name="modelId" [(ngModel)]="modelForm.model_id" required pattern="[a-z0-9][a-z0-9-]{1,62}" placeholder="fraud-detector"></label><label>Name<input name="modelName" [(ngModel)]="modelForm.name" required placeholder="Fraud detector"></label><label>Owner<input name="owner" [(ngModel)]="modelForm.owner" required placeholder="ML Platform"></label><label>Framework<input name="framework" [(ngModel)]="modelForm.framework" required placeholder="sklearn"></label><button class="primary" type="submit" [disabled]="busy">Register model</button></form>
<form *ngIf="selected as model; else selectForVersion" (ngSubmit)="addVersion()"><h3>Add version <small>{{ model.model_id }}</small></h3><label>Semantic version<input name="version" [(ngModel)]="versionForm.version" required pattern="[0-9]+\.[0-9]+\.[0-9]+" placeholder="1.0.0"></label><label>Artifact URI<input name="artifactUri" [(ngModel)]="versionForm.artifact_uri" required placeholder="s3://models/fraud/1.0.0"></label><label>Training data ref <input name="trainingDataRef" [(ngModel)]="versionForm.training_data_ref" placeholder="dataset-2026-08"></label><button class="primary" type="submit" [disabled]="busy">Add version</button></form><ng-template #selectForVersion><div class="form-placeholder"><h3>Add version</h3><p>Select a model first.</p></div></ng-template>
<form (ngSubmit)="requestDeployment()"><h3>Request deployment</h3><label>Model<select name="deploymentModel" [(ngModel)]="deploymentForm.model_id" required><option value="">Select model</option><option *ngFor="let model of (models$ | async)" [value]="model.model_id">{{ model.name }}</option></select></label><label>Version<input name="deploymentVersion" [(ngModel)]="deploymentForm.version" required placeholder="1.0.0"></label><label>Environment<select name="environment" [(ngModel)]="deploymentForm.environment"><option value="staging">Staging</option><option value="production">Production</option></select></label><label class="check"><input type="checkbox" name="simulateFailure" [(ngModel)]="deploymentForm.simulate_failure"> Simulate failure</label><button class="primary" type="submit" [disabled]="busy">Deploy</button><small>Production requests remain subject to backend approval rules.</small></form></div></section>
<section class="deployments"><div class="section-heading"><div><p class="eyebrow">DELIVERY HISTORY</p><h2>Deployments</h2></div><button (click)="loadDeployments()">Refresh</button></div><ng-container *ngIf="deployments$ | async as deployments; else deploymentLoading"><p class="empty" *ngIf="!deployments.length">No deployments yet.</p><div class="deployment-list"><article *ngFor="let deployment of deployments" class="deployment" [class.active]="selectedDeployment?.deployment_id === deployment.deployment_id" (click)="selectDeployment(deployment)"><div><strong>{{ deployment.deployment_id }}</strong><small>{{ deployment.model_id }} · v{{ deployment.version }} · {{ deployment.environment }}</small></div><span class="pill" [class.failure]="deployment.status === 'FAILED'">{{ deployment.status }}</span></article></div><article class="deployment-detail" *ngIf="selectedDeployment as deployment"><div><h3>{{ deployment.deployment_id }}</h3><p>{{ deployment.model_id }} v{{ deployment.version }} · {{ deployment.environment }}</p></div><div class="actions"><button *ngIf="deployment.status === 'FAILED'" (click)="retryDeployment(deployment.deployment_id)">Retry</button><button *ngIf="deployment.status === 'SUCCEEDED' && deployment.environment === 'production'" (click)="rollbackDeployment(deployment.deployment_id)">Rollback</button></div><h4>Events</h4><p *ngFor="let event of deployment.events"><small>{{ event.timestamp | date:'short' }} · {{ event.event }} · {{ event.status }}</small></p></article></ng-container><ng-template #deploymentLoading><p class="empty">Loading deployment history...</p></ng-template></section>
</main>`,
styles: [`
  .operations,.deployments{margin-top:18px;background:#fff;border:1px solid #d9e1da;padding:24px}
  .section-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
  .section-heading h2{margin-bottom:0}
  .muted{color:#617069;font:500 .72rem 'DM Mono',monospace}
  .operation-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .operation-grid form,.form-placeholder{border-top:2px solid #d5ebc9;padding-top:16px}
  .operation-grid h3{margin-bottom:18px}
  .operation-grid h3 small{margin-left:7px}
  .operation-grid label{display:flex;flex-direction:column;gap:7px;margin:12px 0;color:#617069;font:500 .72rem 'DM Mono',monospace}
  .operation-grid input,.operation-grid select{width:100%;padding:11px 12px;border:1px solid #bdc9bf;background:#f8faf7;border-radius:3px;font:inherit;color:#17231e}
  .operation-grid .check{display:block;color:#17231e}
  .operation-grid .check input{width:auto;margin-right:7px}
  .operation-grid button,.deployments button,.version-actions button{border:1px solid #bdc9bf;background:#fff;color:#17231e;padding:9px 11px;border-radius:3px;font:500 .7rem 'DM Mono',monospace;cursor:pointer}
  .operation-grid button.primary{width:100%;background:#17231e;border-color:#17231e;color:#fff}
  .operation-grid button:disabled{opacity:.5;cursor:wait}
  .operation-grid form>small{display:block;margin-top:12px;line-height:1.5}
  .message{padding:12px 14px;margin:0 0 18px;border-left:3px solid}
  .message.success{background:#edf7e9;border-color:#4e9b57;color:#28633a}
  .message.error{background:#fff0ed;border-color:#bd5b4d;color:#84382e}
  .version-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
  .version-actions button{font-size:.62rem;padding:7px}
  .deployment-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:10px}
  .deployment{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #d9e1da;padding:14px;cursor:pointer}
  .deployment.active{border-color:#16704b;background:#f4f8f3}
  .deployment strong,.deployment small{display:block}
  .deployment small{margin-top:7px}
  .pill.failure{background:#f5d7d1;color:#84382e}
  .deployment-detail{border-top:1px solid #d9e1da;margin-top:18px;padding-top:18px;display:grid;grid-template-columns:1fr auto;gap:5px 20px}
  .deployment-detail h3,.deployment-detail p{margin:0}
  .deployment-detail h4{grid-column:1/-1;margin:14px 0 0}
  .deployment-detail p{grid-column:1/-1}
  .actions{display:flex;gap:8px}
  .form-placeholder p{color:#87938c}
  .comparison{border-top:1px solid #d9e1da;padding:16px 0;margin-bottom:28px}.comparison select,.comparison button{margin-right:8px;padding:8px;border:1px solid #bdc9bf;background:#fff;font:500 .7rem 'DM Mono',monospace}.comparison p{margin-bottom:0}
  @media(max-width:900px){.operation-grid{grid-template-columns:1fr 1fr}.operation-grid form:last-child{grid-column:1/-1}}
  @media(max-width:760px){.operation-grid{grid-template-columns:1fr}.operation-grid form:last-child{grid-column:auto}.deployment-detail{display:block}.actions{margin-top:14px}}
`] })
export class AppComponent {
  private readonly http = inject(HttpClient); readonly api = 'http://localhost:8000';
  models$: Observable<Model[]> = of([]); metrics$: Observable<Metric[]> = of([]); deployments$: Observable<Deployment[]> = of([]); selected?: Model; selectedDeployment?: Deployment; comparison?: VersionComparison;
  comparisonLeft = ''; comparisonRight = ''; modelLoadError = '';
  busy = false; errorMessage = ''; successMessage = '';
  modelForm: ModelCreate = { model_id: '', name: '', owner: '', framework: '' };
  versionForm: VersionCreate = { version: '', artifact_uri: '', training_data_ref: '' };
  deploymentForm: DeploymentCreate = { model_id: '', version: '', environment: 'staging', simulate_failure: false };

  constructor() { this.load(); this.loadDeployments(); }
  load(search = ''): void { this.modelLoadError = ''; this.models$ = this.http.get<Model[]>(`${this.api}/models?search=${encodeURIComponent(search)}`).pipe(catchError(() => { this.modelLoadError = 'Model inventory is unavailable. Check the API and try again.'; return of([]); })); }
  select(model: Model): void { this.selected = model; this.comparison = undefined; this.comparisonLeft = model.versions[0]?.version || ''; this.comparisonRight = model.versions[1]?.version || ''; this.deploymentForm.model_id = model.model_id; this.loadMetrics(model.model_id); this.loadDeployments(model.model_id); }
  loadMetrics(modelId: string): void { this.metrics$ = this.http.get<Metric[]>(`${this.api}/models/${modelId}/metrics`).pipe(catchError(() => { this.errorMessage = 'Monitoring data is unavailable.'; return of([]); })); }
  compareVersions(): void { if (!this.selected || !this.comparisonLeft || !this.comparisonRight) return; this.http.get<VersionComparison>(`${this.api}/models/${this.selected.model_id}/versions/compare?left=${encodeURIComponent(this.comparisonLeft)}&right=${encodeURIComponent(this.comparisonRight)}`).subscribe({ next: result => this.comparison = result, error: error => this.showError(error) }); }
  loadDeployments(modelId?: string): void { const query = modelId ? `?model_id=${encodeURIComponent(modelId)}` : ''; this.deployments$ = this.http.get<Deployment[]>(`${this.api}/deployments${query}`).pipe(catchError(() => of([]))); }
  canTransition(version: Version, target: Lifecycle): boolean { const transitions: Record<Lifecycle, Lifecycle[]> = { DRAFT: ['VALIDATED'], VALIDATED: ['APPROVED'], APPROVED: ['STAGING'], STAGING: ['PRODUCTION'], PRODUCTION: [], ARCHIVED: [] }; return transitions[version.stage].includes(target); }
  registerModel(): void { this.runOperation(this.http.post<Model>(`${this.api}/models`, this.modelForm), 'Model registered.'); }
  addVersion(): void { if (!this.selected) return; this.runOperation(this.http.post<Version>(`${this.api}/models/${this.selected.model_id}/versions`, this.versionForm), 'Version added.'); }
  changeLifecycle(version: Version, stage: Lifecycle): void { if (!this.selected) return; this.runOperation(this.http.post<Version>(`${this.api}/models/${this.selected.model_id}/versions/${version.version}/lifecycle`, { stage }), `Version moved to ${stage}.`); }
  requestDeployment(): void { const key = `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`; this.runOperation(this.http.post<Deployment>(`${this.api}/deployments`, this.deploymentForm, { headers: { 'X-Idempotency-Key': key } }), 'Deployment request recorded.', true); }
  retryDeployment(id: string): void { this.runOperation(this.http.post<Deployment>(`${this.api}/deployments/${id}/retry`, {}), 'Deployment retried.', true); }
  rollbackDeployment(id: string): void { this.runOperation(this.http.post<Deployment>(`${this.api}/deployments/${id}/rollback`, {}), 'Deployment rolled back.', true); }
  selectDeployment(deployment: Deployment): void { this.http.get<Deployment>(`${this.api}/deployments/${deployment.deployment_id}`).subscribe({ next: detail => this.selectedDeployment = detail, error: error => this.showError(error) }); }
  private runOperation<T>(request: Observable<T>, success: string, refreshDeployments = false): void { this.busy = true; this.errorMessage = ''; this.successMessage = ''; request.subscribe({ next: () => { this.busy = false; this.successMessage = success; this.load(); if (this.selected) { this.http.get<Model>(`${this.api}/models/${this.selected.model_id}`).subscribe(model => { this.selected = model; }); } if (refreshDeployments) this.loadDeployments(this.selected?.model_id); }, error: error => { this.busy = false; this.showError(error); } }); }
  private showError(error: HttpErrorResponse): void { const detail = error.error?.detail; this.errorMessage = detail?.message || `Request failed (${error.status || 'network error'}).`; this.successMessage = ''; }
}
