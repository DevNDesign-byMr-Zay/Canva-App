# HOLOFORGE Product Design v1

## Product statement

HOLOFORGE is a separate Canva app concept for exploring design futures before changing the source design. It turns a Canva snapshot plus user intent into bounded candidate scenarios, makes the evidence behind those scenarios visible, and requires an explicit human choice before any selected candidate can be applied.

The app is a presentation and decision surface, not a source of computational truth and not an autonomous control system.

## Core principle

**AUREN decides what scenario is meaningful. VÆLON demonstrates what can be computed. HOLOFORGE lets the human see, compare, and choose.**

## Product flow

`design snapshot -> intent + constraints -> scenario plan -> reproducible candidate evidence -> spatial compare -> explicit apply`

No stage may silently skip the evidence boundary or apply a design change without a direct user action.

## System ownership

### HOLOFORGE / Canva

Owns:
- source-design capture and preview;
- intent and constraint entry UI;
- branch/scenario browsing;
- 2.5D spatial comparison;
- evidence presentation;
- target-adapter selection;
- explicit apply confirmation;
- Canva-side mutation only after confirmation.

Does not own:
- optimization truth;
- solver claims;
- benchmark generation;
- provider authority;
- physical actuation.

### AUREN

Owns:
- interpretation of the user's design intent;
- conversion of intent into explicit objectives and constraints;
- scenario meaning and semantic labels;
- admissibility rules;
- comparison framing;
- explanation of tradeoffs.

AUREN may rank or explain scenarios, but must not manufacture computational evidence.

### VÆLON

Owns:
- deterministic candidate generation/search;
- algorithm/backend identity;
- seed and reproducibility metadata;
- objective measurements;
- classical-reference comparison;
- bounded evidence envelope;
- failure/uncertainty reporting.

VÆLON must not claim superiority without measured evidence against the selected baseline.

### Classical reference

Provides the correctness and measurement baseline for the first prototype. Candidate methods may include deterministic quantum-inspired or future quantum adapters, but every candidate is evaluated through the same evidence contract.

## UX architecture

### 1. Forge Home

Purpose: establish the source and the user goal without immediately changing anything.

Primary regions:
- **Source Design**: thumbnail, design name, page count, snapshot status, snapshot ID.
- **Intent**: natural-language goal input.
- **Constraints**: compact chips/controls for locked elements, spacing, hierarchy, accessibility, brand rules, page scope, and allowed movement.
- **Forge Scenario**: starts interpretation and candidate planning.

State labels:
- Source captured
- Intent interpreted
- Constraints validated
- Ready to forge

### 2. Scenario Lab

Purpose: make candidate generation inspectable rather than magical.

Layout:
- left rail: scenario branches;
- center: current candidate summary;
- right evidence rail: backend, algorithm, seed, duration, score, baseline gap, provenance status.

Each scenario card shows:
- scenario name;
- objective score;
- delta from source;
- gap from classical reference;
- constraint status;
- computation status;
- short AUREN explanation.

The UI must distinguish measured facts from semantic interpretation.

### 3. Holo Stage

Purpose: compare the source and candidate as a layered spatial model.

Initial browser-compatible mode is 2.5D, not hardware-dependent XR.

Controls:
- depth slider;
- original/candidate scrubber;
- branch switcher;
- relationship lines toggle;
- attention overlay toggle;
- evidence markers toggle;
- reset view.

Visual layers:
1. source frame;
2. candidate frame;
3. changed elements;
4. constraint boundaries;
5. hierarchy/relationship lines;
6. attention annotations;
7. evidence markers.

Targets remain adapters, not separate sources of truth. The initial target is the web dashboard; later targets can include holo-mat, projector, volumetric 3D, and AR/VR.

### 4. Evidence Drawer

Purpose: make every candidate auditable before selection.

Required sections:
- source snapshot identity;
- scenario identity;
- AUREN objective + constraints;
- VÆLON backend/algorithm;
- deterministic seed;
- runtime/duration;
- objective score;
- classical baseline score;
- objective gap;
- changed-element count;
- provenance fingerprint;
- warnings / uncertainty;
- advisory-only status.

A candidate with missing or invalid evidence is preview-disabled and apply-disabled.

### 5. Apply Gate

Purpose: create a clear line between exploration and mutation.

The apply panel must show:
- selected scenario;
- number of affected elements/pages;
- locked elements preserved;
- constraint validation status;
- evidence/provenance status;
- reversible-operation note when supported;
- explicit **Apply selected scenario** action.

There is no automatic apply, background apply, or actuation path.

## Interaction states

### Idle
Source design is visible; no candidate exists.

### Interpreting
AUREN is converting intent into explicit objective/constraints. The UI shows the derived interpretation before compute starts.

### Computing
VÆLON is producing bounded candidates and evidence. Progress may be shown, but no speculative score should be displayed before evidence exists.

### Ready to compare
At least one candidate has passed the evidence boundary and may be opened in Holo Stage.

### Evidence failure
The affected candidate is marked unavailable. The app shows the reason and preserves the source state.

### Selected
One candidate is selected for possible application; the source design is still unchanged.

### Applied
Canva-side mutation occurs only after the explicit apply action completes successfully.

## Visual direction

HOLOFORGE should feel like an instrument panel for creative futures, not a sci-fi decoration layer.

Recommended visual language:
- gunmetal / graphite base;
- controlled luminous accents for depth and evidence state;
- strong geometric framing;
- restrained glass depth rather than heavy transparency;
- high-contrast typography;
- motion used to explain state transitions and spatial relationships;
- no visual effect may obscure score provenance, warnings, or the apply gate.

Color semantics should be functional:
- neutral: source/original;
- cool luminous accent: candidate/preview;
- gold: selected/confirmed attention;
- amber: warning / degraded evidence;
- red: invalid / blocked / provenance failure.

## First prototype

### Experiment

Use a small binary placement/assignment problem derived from a captured Canva design snapshot.

Example objective:
- improve a defined spatial/hierarchy score while preserving locked elements and required relationships.

### Required comparison

For the same normalized problem:
1. exact/classical reference;
2. VÆLON deterministic candidate method.

Display:
- both objective scores;
- candidate gap from exact reference;
- duration for each method;
- seed/algorithm identity;
- resulting element movement;
- whether every hard constraint passed.

### Prototype acceptance

The first prototype is accepted only when:
- identical normalized inputs + seed produce identical VÆLON evidence;
- classical-reference output is reproducible;
- the UI never presents a candidate without valid evidence;
- Holo Stage can compare source and candidate without mutating the source;
- explicit apply is the only mutation boundary;
- provenance tampering fails closed;
- the finalized existing Canva runtime remains unchanged.

## Design boundaries

Do not:
- wire HOLOFORGE into the finalized authenticated runtime during concept validation;
- treat AUREN explanations as solver evidence;
- treat VÆLON results as authoritative without a baseline/evidence record;
- introduce live grid/device actuation;
- require XR hardware for the first version;
- hide provenance or failed constraints behind visual polish;
- auto-apply a scenario.

## Next implementation slices

### AUREN slice
- define the intent-to-objective schema;
- define hard vs soft constraints;
- define admissibility and explanation output;
- provide deterministic fixtures for at least three intent classes.

### VÆLON slice
- define normalized placement problem input;
- implement/reference the exact classical baseline;
- implement one deterministic candidate method;
- emit evidence with backend, algorithm, seed, score, duration, and baseline gap;
- prove reproducibility with focused tests.

### HOLOFORGE slice
- implement the Scenario Contract parser/validator;
- build static Scenario Lab using fixtures only;
- build source/candidate 2.5D compare;
- make the Evidence Drawer fail closed;
- keep Apply Gate mocked until evidence and preview contracts are stable.
