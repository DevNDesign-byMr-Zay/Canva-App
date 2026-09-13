import { prototypeScenarios } from './scenarios.js';
import { createPrototypeState, isScenarioSelected, reducePrototypeState } from './state.js';

const scenarios = prototypeScenarios;

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
const source = document.querySelector('#sourceFrame');
const candidate = document.querySelector('#candidateFrame');
const applyButton = document.querySelector('#applyButton');
const evidenceState = document.querySelector('#evidenceState');
const stageViewport = document.querySelector('#stageViewport');

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

function renderList() {
  list.replaceChildren(...scenarios.map((scenario) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scenario-card${scenario.id === state.scenarioId ? ' active' : ''}`;
    button.dataset.scenario = scenario.id;
    button.setAttribute('aria-pressed', String(scenario.id === state.scenarioId));
    button.innerHTML = `<strong>${scenario.title}</strong><span class="scenario-meta"><span class="score-badge">score ${formatMetric(scenario.score)}</span><span>${scenario.changed} changes</span></span>`;
    button.addEventListener('click', () => {
      state = reducePrototypeState(state, { type: 'select-scenario', scenarioId: scenario.id });
      applyButton.textContent = 'Apply selected scenario';
      render();
    });
    return button;
  }));
}

function renderScenario() {
  const scenario = scenarios.find((item) => item.id === state.scenarioId);
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
}

function renderCompare() {
  const value = state.comparePercent / 100;
  compare.value = String(state.comparePercent);
  compare.setAttribute('aria-valuetext', `${state.comparePercent}% candidate`);
  compareValue.textContent = `${state.comparePercent}%`;
  source.style.opacity = String(Math.max(0.18, 1 - value * 0.85));
  candidate.style.opacity = String(Math.max(0.18, value));
  candidate.style.filter = `saturate(${0.65 + value * 0.6})`;
}

function renderOverlays() {
  document.querySelectorAll('[data-overlay]').forEach((button) => {
    const enabled = state.overlays[button.dataset.overlay];
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', String(enabled));
  });

  document.querySelectorAll('.relationship-line').forEach((line) => {
    line.hidden = !state.overlays.relationships;
  });
  document.querySelectorAll('.evidence-pin').forEach((pin) => {
    pin.hidden = !state.overlays.evidence;
  });
  stageViewport.classList.toggle('attention-on', state.overlays.attention);
}

function renderSelection() {
  const selected = isScenarioSelected(state);
  candidate.style.outline = selected ? '2px solid rgba(210,169,74,.85)' : '';
  candidate.setAttribute('aria-pressed', String(selected));
  applyButton.disabled = !selected;
}

function render() {
  renderList();
  renderScenario();
  renderCompare();
  renderOverlays();
  renderSelection();
}

document.querySelectorAll('[data-overlay]').forEach((button) => {
  button.addEventListener('click', () => {
    state = reducePrototypeState(state, { type: 'toggle-overlay', overlay: button.dataset.overlay });
    renderOverlays();
  });
});

compare.addEventListener('input', () => {
  state = reducePrototypeState(state, { type: 'set-compare', percent: Number(compare.value) });
  renderCompare();
});

document.querySelector('#resetView').addEventListener('click', () => {
  state = reducePrototypeState(state, { type: 'reset-view' });
  renderCompare();
});

function toggleCandidateSelection() {
  state = reducePrototypeState(state, { type: 'toggle-selection' });
  applyButton.textContent = 'Apply selected scenario';
  renderSelection();
}

candidate.addEventListener('click', toggleCandidateSelection);
candidate.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  toggleCandidateSelection();
});

applyButton.addEventListener('click', () => {
  if (!isScenarioSelected(state)) return;
  applyButton.textContent = 'Prototype only — source unchanged';
  applyButton.disabled = true;
});

render();
