const scenarios = [
  {
    id: 'hierarchy-first',
    title: 'Hierarchy Focus',
    interpretation: 'Increase headline dominance while preserving locked brand marks.',
    score: 0.92,
    baseline: 0.95,
    gap: 0.03,
    duration: '12 ms',
    objective: 'hierarchy-balance-v1',
    seed: 'hierarchy-seed-001',
    tradeoff: 'Slightly increases vertical separation to improve hierarchy.',
    changed: 2,
  },
  {
    id: 'spacing-balance',
    title: 'Spatial Balance',
    interpretation: 'Improve spacing rhythm and edge balance with minimal movement.',
    score: 84,
    baseline: 86,
    gap: 2,
    duration: '12 ms',
    objective: 'spacing-balance-v1',
    seed: 'spacing-seed-001',
    tradeoff: 'Preserves content order while increasing lateral balance.',
    changed: 2,
  },
  {
    id: 'locked-brand',
    title: 'Brand-Safe Reflow',
    interpretation: 'Reflow supporting content without moving protected brand elements.',
    score: 0.88,
    baseline: 0.9,
    gap: 0.02,
    duration: '12 ms',
    objective: 'brand-safe-reflow-v1',
    seed: 'brand-seed-001',
    tradeoff: 'Keeps protected brand geometry fixed while rebalancing support copy.',
    changed: 2,
  },
];

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
  duration.textContent = scenario.duration;
  objective.textContent = scenario.objective;
  seed.textContent = scenario.seed;
  tradeoff.textContent = scenario.tradeoff;
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
  applyButton.textContent = selected ? 'Apply selected scenario' : 'Apply selected scenario';
});

applyButton.addEventListener('click', () => {
  if (!selected) return;
  applyButton.textContent = 'Prototype only — source unchanged';
  applyButton.disabled = true;
});

render();
