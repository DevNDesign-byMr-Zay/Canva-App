import { Alert } from "@canva/app-ui-kit";
import { useCallback, useState } from "react";

import { readDepthPopSourceSnapshot, type DepthPopSourceSnapshot } from "./canva-context";
import { DepthPopPanel } from "./depthpop/depthpop-panel";

import "./app.css";

export function App() {
  const [snapshot, setSnapshot] = useState<DepthPopSourceSnapshot | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsReading(true);
    setError(null);
    try {
      setSnapshot(await readDepthPopSourceSnapshot());
    } catch (cause) {
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message : "DepthPop could not read the current Canva design.");
    } finally {
      setIsReading(false);
    }
  }, []);

  return (
    <div className="dp-app-frame">
      {error && <Alert tone="critical">{error}</Alert>}
      <DepthPopPanel snapshot={snapshot} isReading={isReading} onRefresh={refresh} />
    </div>
  );
}
