import { reconstructSourceConfig, projectDesignConfig } from './geometry.js';
import { prototypeScenarios } from './scenarios.js';
import { getPrototypeApplyState } from './scenario-gate.js';
import { resolveCurrentSnapshotFingerprint } from './snapshot-context.js';
import {
  createPrototypeState,
  isScenarioSelected,
  reducePrototypeState,
  resolveScenarioNavigation,
} from './state.js';

const scenarios = prototypeScenarios;
const scenarioIds = scenarios.map((scenario) => scenario.id);
const currentSnapshotFingerprint = resolveCurrentSnapshotFingerprint({
  fallbackFingerprint: scenarios[0]?.sourceSnapshotFingerprint,
});

const list = document.querySelector('#scenarioList');
const title = document.querySelector('#scenarioTitle');
const interpretation = document.querySelector('#interpretationSummary');
const candidateScore = document.querySelector('#candidateScore');
const baselineScore = document.querySelector('#baselineScore');
const gap = document.querySelector('#objectiveGap');
const duration = document.querySelector('#duration');
const objective = document.querySelector('#objectiveId');
const seed = document.querySelector('#seed');
const backendIdentity = document.querySelector('#backendIdentity');
const baselineIdentity = document.querySelector('#baselineIdentity');
const snapshotId = document.querySelector('#snapshotId');
const optimizationFingerprint = document.querySelector('#optimizationFingerprint');
const scenarioFingerprint = document.querySelector('#scenarioFingerprint');
const constraintState = document.querySelector('#constraintState');
const tradeoff = document.querySelector('#tradeoffText');
const compare = document.querySelector('#compareRange');
const compareValue = document.querySelector('#compareValue');
const depth = document.querySelector('#depthRange');
const depthValue = document.querySelector('#depthValue');
const source = document.querySelector('#sourceFrame');
const candidate = document.querySelector('#candidateFrame');
const sourceCanvas = document.querySelector('#sourceCanvas');
const candidateCanvas = document.querySelector('#candidateCanvas');
const applyButton = document.querySelector('#applyButton');
const evidenceState = document.querySelector('#evidenceState');
const stageViewport = document.querySelector('#stageViewport');
const stageAnnouncement = document.querySelector('#stageAnnouncement');

let state = createPrototypeState(scenarios[0].id);

function formatMetric(value) {
  if (!Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function shortFingerprint(value) {
  if (typeof value !== 'string' || value.length < 16) return '—';
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

function currentScenario() {
  return scenarios.find((scenario) => scenario.id === state.scenarioId);
}

function announce(message) {
  stageAnnouncement.textContent = message;
}

function visualKind(id) {
  if (id.startsWith('logo')) return 'logo';
  if (id.startsWith('headline')) return 'headline';
  if (id.startsWith('body')) return 'body';
  if (id.startsWith('card')) return 'card';
  if (id.startsWith('brand-block')) return 'brand-block';
  if (id.startsWith('caption')) return 'caption';
  return 'generic';
}

function appendVisualContent(node, id, kind) {
  if (kind === 'logo') { node.textContent = 'MZ'; return; }
  if (kind === 'headline') { node.textContent = "CREATE WHAT'S NEXT"; return; }
  if (kind === 'brand-block') { node.textContent = 'BRAND'; return; }
  if (kind === 'caption') { node.textContent = id.endsWith('1') ? 'Supporting copy' : 'Secondary detail'; return; }
  if (kind === 'body') { node.append(document.createElement('span'), document.createElement('span')); return; }
  if (kind === 'card') {
    const label = document.createElement('strong');
    label.textContent = id.replace('-', ' ').toUpperCase();
    node.append(label, document.createElement('span'), document.createElement('span'));
    return;
  }
  node.textContent = id;
}

function createFixtureElement(id, config, { changed = false, evidenceIndex = null, view }) {
  const kind = visualKind(id);
  const projected = projectDesignConfig(config);
  const element = document.createElement('div');
  element.className = `fixture-element fixture-${kind}`;
  element.dataset.elementId = id;
  element.dataset.view = view;
  if (config.locked === true) element.classList.add('locked');
  if (changed) element.classList.add('changed');
  element.style.left = `${projected.leftPercent}%`;
  element.style.top = `${projected.topPercent}%`;
  element.style.transform = `translate(-50%,-50%) translateZ(${projected.z * 2}px) scale(${projected.scale})`;
  appendVisualContent(element, id, kind);
  if (config.locked === true) {
    const lock = document.createElement('span');
    lock.className = 'lock-badge';
    lock.textContent = 'LOCK';
    element.append(lock);
  }
  if (changed && view === 'candidate' && evidenceIndex != null) {
    const pin = document.createElement('span');
    pin.className = 'evidence-pin fixture-pin';
    pin.textContent = String(evidenceIndex + 1).padStart(2, '0');
    element.append(pin);
  }
  return element;
}

function renderFixtureStage(scenario) {
  const sourceElements = [];
  const candidateElements = [];
  const changedIds = new Set(scenario.changedElementIds);
  const changedOrder = new Map(scenario.changedElementIds.map((id, index) => [id, index]));
  for (const [id, candidateConfig] of Object.entries(scenario.layout)) {
    const delta = scenario.delta[id] ?? {};
    sourceElements.push(createFixtureElement(id, reconstructSourceConfig(candidateConfig, delta), {
      changed: changedIds.has(id), evidenceIndex: changedOrder.get(id), view: 'source',
    }));
    candidateElements.push(createFixtureElement(id, candidateConfig, {
      changed: changedIds.has(id), evidenceIndex: changedOrder.get(id), view: 'candidate',
    }));
  }
  sourceCanvas.replaceChildren(...sourceElements);
  candidateCanvas.replaceChildren(...candidateElements);
}

function selectScenario(scenarioId, { focus = false } = {}) {
  const changed = scenarioId !== state.scenarioId;
  if (!changed && !focus) return;
  state = reducePrototypeState(state, { type: 'select-scenario', scenarioId });
  applyButton.textContent = 'Apply selected scenario';
  render();
  if (changed) {
    const scenario = currentScenario();
    announce(`${scenario.title} loaded. ${scenario.changed} changes. ${scenario.status === 'complete' ? 'Evidence complete.' : `Evidence ${scenario.status}.`} Source unchanged.`);
  }
  if (focus) list.querySelector(`[data-scenario="${scenarioId}"]`)?.focus();
}

function renderList() {
  list.replaceChildren(...scenarios.map((scenario) => {
    const active = scenario.id === state.scenarioId;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scenario-card${active ? ' active' : ''}`;
    button.dataset.scenario = scenario.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(active));
    button.tabIndex = active ? 0 : -1;
    if (active) button.setAttribute('aria-current', 'true');
    button.innerHTML = `<strong>${scenario.title}</strong><span class="scenario-meta"><span class="score-badge">score ${formatMetric(scenario.score)}</span><span>gap ${formatMetric(scenario.gap)}</span><span>${scenario.changed} changes</span></span>`;
    button.addEventListener('click', () => selectScenario(scenario.id));
    button.addEventListener('keydown', (event) => {
      const nextId = resolveScenarioNavigation(scenarioIds, state.scenarioId, event.key);
      if (nextId === state.scenarioId) return;
      event.preventDefault();
      selectScenario(nextId, { focus: true });
    });
    return button;
  }));
}

function renderScenario() {
  const scenario = currentScenario();
  title.textContent = scenario.title;
  interpretation.textContent = scenario.interpretation;
  candidateScore.textContent = formatMetric(scenario.score);
  baselineScore.textContent = formatMetric(scenario.baseline);
  gap.textContent = formatMetric(scenario.gap);
  duration.textContent = `${scenario.durationMs} ms`;
  objective.textContent = scenario.objective;
  seed.textContent = scenario.seed;
  backendIdentity.textContent = `${scenario.backend} / ${scenario.algorithm}`;
  baselineIdentity.textContent = `${scenario.baselineBackend} / ${scenario.baselineAlgorithm}`;
  snapshotId.textContent = scenario.sourceSnapshotId;
  optimizationFingerprint.textContent = shortFingerprint(scenario.optimizationFingerprint);
  optimizationFingerprint.title = scenario.optimizationFingerprint;
  scenarioFingerprint.textContent = shortFingerprint(scenario.scenarioFingerprint);
  scenarioFingerprint.title = scenario.scenarioFingerprint;
  constraintState.textContent = scenario.hardConstraintsPassed ? 'Passed' : 'Blocked';
  constraintState.classList.toggle('verified', scenario.hardConstraintsPassed);
  tradeoff.textContent = scenario.tradeoff;
  evidenceState.textContent = scenario.status === 'complete' ? 'EVIDENCE COMPLETE' : scenario.status.toUpperCase();
  evidenceState.title = `CI-validated presentation projection for ${scenario.sourceSnapshotId} / ${scenario.target}`;
  renderFixtureStage(scenario);
}

function renderCompare() {
  const value = state.comparePercent / 100;
  compare.value = String(state.comparePercent);
  compare.setAttribute('aria-valuetext', `${state.comparePercent}% candidate`);
  compareValue.textContent = `${state.comparePercent}%`;
  source.style.opacity = String(Math.max(0.18, 1 - value * 0.85));
  candidate.style.opacity = String(Math.max(0.18, value));
  candidate.style.filter = `saturate(${0.65 + value * 0.6})`;
  document.querySelectorAll('[data-compare-preset]').forEach((button) => {
    const values = { original: 0, split: 58, candidate: 100 };
    const active = values[button.dataset.comparePreset] === state.comparePercent;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderDepth() {
  const normalized = state.depthPercent / 100;
  const sourceZ = -40 - normalized * 80;
  const candidateZ = 25 + normalized * 50;
  depth.value = String(state.depthPercent);
  depth.setAttribute('aria-valuetext', `${state.depthPercent}% spatial depth`);
  depthValue.textContent = `${state.depthPercent}%`;
  source.style.transform = `translate(-62%,-50%) translateZ(${sourceZ}px) rotateY(7deg)`;
  candidate.style.transform = `translate(-38%,-46%) translateZ(${candidateZ}px) rotateY(-7deg)`;
}

function renderOverlays() {
  document.querySelectorAll('[data-overlay]').forEach((button) => {
    const enabled = state.overlays[button.dataset.overlay];
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', String(enabled));
  });
  document.querySelectorAll('.relationship-line').forEach((line) => { line.hidden = !state.overlays.relationships; });
  document.querySelectorAll('.evidence-pin').forEach((pin) => { pin.hidden = !state.overlays.evidence; });
  stageViewport.classList.toggle('attention-on', state.overlays.attention);
}

function renderSelection() {
  const selected = isScenarioSelected(state);
  const scenario = currentScenario();
  const gateState = getPrototypeApplyState(scenario, {
    selectedScenarioId: state.selectedScenarioId,
    currentSnapshotFingerprint,
    explicitApply: true,
  });
  candidate.style.outline = selected ? '2px solid rgba(210,169,74,.85)' : '';
  candidate.setAttribute('aria-pressed', String(selected));
  candidate.setAttribute('aria-label', `${scenario.title} candidate. ${scenario.changed} changed elements. ${selected ? 'Selected' : 'Not selected'} for prototype apply review.`);
  applyButton.disabled = !gateState.canApply;
  applyButton.title = gateState.canApply ? 'Ready for explicit prototype acknowledgement.' : `Blocked: ${gateState.blockReason}`;
}

function render() {
  renderList();
  renderScenario();
  renderCompare();
  renderDepth();
  renderOverlays();
  renderSelection();
}

document.querySelectorAll('[data-overlay]').forEach((button) => {
  button.addEventListener('click', () => {
    state = reducePrototypeState(state, { type: 'toggle-overlay', overlay: button.dataset.overlay });
    renderOverlays();
    announce(`${button.textContent} overlay ${state.overlays[button.dataset.overlay] ? 'shown' : 'hidden'}.`);
  });
});

document.querySelectorAll('[data-compare-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    state = reducePrototypeState(state, { type: 'set-compare-preset', preset: button.dataset.comparePreset });
    renderCompare();
    announce(`Compare view set to ${button.textContent}.`);
  });
});

compare.addEventListener('input', () => {
  state = reducePrototypeState(state, { type: 'set-compare', percent: Number(compare.value) });
  renderCompare();
});

depth.addEventListener('input', () => {
  state = reducePrototypeState(state, { type: 'set-depth', percent: Number(depth.value) });
  renderDepth();
});

document.querySelector('#resetView').addEventListener('click', () => {
  state = reducePrototypeState(state, { type: 'reset-view' });
  renderCompare();
  renderDepth();
  announce('Stage view reset to split comparison and default depth.');
});

function toggleCandidateSelection() {
  state = reducePrototypeState(state, { type: 'toggle-selection' });
  applyButton.textContent = 'Apply selected scenario';
  renderSelection();
  announce(isScenarioSelected(state)
    ? `${currentScenario().title} selected for prototype apply review. Source remains unchanged.`
    : 'Candidate selection cleared. Source remains unchanged.');
}

candidate.addEventListener('click', toggleCandidateSelection);
candidate.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isScenarioSelected(state)) {
    event.preventDefault();
    toggleCandidateSelection();
    return;
  }
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  toggleCandidateSelection();
});

applyButton.addEventListener('click', () => {
  if (!isScenarioSelected(state)) return;
  applyButton.textContent = 'Prototype only — source unchanged';
  applyButton.disabled = true;
  announce('Prototype apply acknowledged. No Canva source mutation was performed.');
});

render();
