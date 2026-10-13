export function useSelection() {
  return {
    count: 0,
    async read() {
      return { contents: [] };
    },
  };
}
