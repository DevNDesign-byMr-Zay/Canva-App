export function createOptimizationRegistry(providers = {}) {
  const entries = new Map(Object.entries(providers));

  return {
    list() {
      return [...entries.keys()].sort();
    },
    register(name, provider) {
      if (typeof name !== 'string' || name.length === 0) throw new TypeError('provider name is required.');
      if (!provider || typeof provider.solve !== 'function') throw new TypeError('provider must expose solve(problem).');
      entries.set(name, provider);
      return provider;
    },
    get(name) {
      const provider = entries.get(name);
      if (!provider) throw new RangeError(`unknown optimization provider: ${name}`);
      return provider;
    },
  };
}
