export type ApplyRunGate = Readonly<{
  tryAcquire: () => number | null;
  release: (token: number) => boolean;
  isHeld: () => boolean;
}>;

export function createApplyRunGate(): ApplyRunGate {
  let activeToken: number | null = null;
  let nextToken = 1;

  return Object.freeze({
    tryAcquire() {
      if (activeToken !== null) return null;
      const token = nextToken;
      nextToken += 1;
      activeToken = token;
      return token;
    },
    release(token) {
      if (activeToken !== token) return false;
      activeToken = null;
      return true;
    },
    isHeld() {
      return activeToken !== null;
    },
  });
}
