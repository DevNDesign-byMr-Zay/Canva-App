import { prototypeScenarios } from './scenarios.js';

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
const tradeoff = document.querySelector('#tradeoffText');
const compare = document.querySelector('#compareRange');
const source = document.querySelector('#sourceFrame');
const candidate = document.querySelector('#candidateFrame');
const applyButton = document.querySelector('#applyButton');
const evidenceState = document.querySelector('#evidenceState');

let activeId = scenarios[0].id;
let selected = false;

function renderList() {
  list.replaceChildren(...scenarios.map((scenario) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scenario-card${scenario.id === activeId ? ' active' : ''}`;
    button.dataset.scenario = scenario.id;
    button.innerHTML = `<strong>${scenario.title}</strong><span class="scenario-meta"><span class="score-badge">score ${scenario.score}</span><span>${scenario.changed} changes</span></span>`;
    button.addEventListener('click', () => {
      activeId = scenario.id;
      selected = false;
      applyButton.disabled = true;
      render();
    });
    return button;
  }));
}

function renderScenario() {
  const scenario = scenarios.find((item) => item.id === activeId);
  title.textContent = scenario.title;
  interpretation.textContent = scenario.interpretation;
  candidateScore.textContent = scenario.score;
  baselineScore.textContent = scenario.baseline;
  gap.textContent = scenario.gap;
  duration.textContent = `${scenario.durationMs} ms`;
  objective.textContent = scenario.objective;
  seed.textContent = scenario.seed;
  tradeoff.textContent = scenario.tradeoff;
  evidenceState.textContent = 'FIXTURE VALIDATED';
  evidenceState.title = `CI-validated scenario projection for ${scenario.sourceSnapshotId} / ${scenario.target}`;
}

function renderCompare() {
  const value = Number(compare.value) / 100;
  source.style.opacity = String(Math.max(0.18, 1 - value * 0.85));
  candidate.style.opacity = String(Math.max(0.18, value));
  candidate.style.filter = `saturate(${0.65 + value * 0.6})`;
}

function render() {
  renderList();
  renderScenario();
  renderCompare();
}

document.querySelectorAll('[data-overlay]').forEach((button) => {
  button.addEventListener('click', () => button.classList.toggle('active'));
});

compare.addEventListener('input', renderCompare);

document.querySelector('#resetView').addEventListener('click', () => {
  compare.value = '58';
  renderCompare();
});

candidate.addEventListener('click', () => {
  selected = !selected;
  candidate.style.outline = selected ? '2px solid rgba(210,169,74,.85)' : '';
  applyButton.disabled = !selected;
});

applyButton.addEventListener('click', () => {
  if (!selected) return;
  applyButton.textContent = 'Prototype only — source unchanged';
  applyButton.disabled = true;
});

render();
