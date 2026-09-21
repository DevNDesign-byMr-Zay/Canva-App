import "@canva/app-ui-kit/styles.css";

import { AppI18nProvider } from "@canva/app-i18n-kit";
import { AppUiProvider } from "@canva/app-ui-kit";
import type { DesignEditorIntent } from "@canva/intents/design";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { loadProductionReviewContext } from "./review-context-mount";

async function render() {
  const rootElement = document.getElementById("root");

  if (!(rootElement instanceof Element)) {
    throw new Error("Unable to find the Canva app root element.");
  }

  const root = createRoot(rootElement);

  let trustedContext: Awaited<ReturnType<typeof loadProductionReviewContext>> | null = null;
  try {
    trustedContext = await loadProductionReviewContext();
  } catch {
    trustedContext = null;
  }

  root.render(
    <AppI18nProvider>
      <AppUiProvider>
        <App
          scenario={trustedContext?.scenario ?? null}
          trustedDesignId={trustedContext?.trustedDesignId}
          trustedPageId={trustedContext?.trustedPageId}
        />
      </AppUiProvider>
    </AppI18nProvider>,
  );
}

const designEditor: DesignEditorIntent = { render };

export default designEditor;
