# Independent frontend quality gates

HoloForge and DepthPop retain separate ESLint, Prettier, TypeScript, Vitest, and production build gates. Each app pins ESLint, typescript-eslint, and Prettier in its own lockfile. Run `npm ci --ignore-scripts`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build` from each app root. The CI matrix and fresh-clone verifier execute those same checks. `npm run format` applies the source formatting locally.

These checks target maintained app source. Historical provenance, reference material, Canva exports, branding, 3D/4D scene behavior, and backend service integration are not rewritten by the gate configuration.
