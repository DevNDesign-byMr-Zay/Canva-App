export function createReferenceProvider({ seed = 1 } = {}) {
  return {
    name: 'canva-runtime-qis-reference-v1',
    solve(problem) {
      const bits = problem.linear.map((coefficient) => (coefficient < 0 ? 1 : 0));
      const objective = problem.linear.reduce((sum, coefficient, index) => sum + coefficient * bits[index], 0);
      return {
        backend: 'canva-runtime-qis-reference-v1',
        algorithm: 'exact-independent-binary-baseline',
        seed,
        bits,
        objective,
      };
    },
  };
}
