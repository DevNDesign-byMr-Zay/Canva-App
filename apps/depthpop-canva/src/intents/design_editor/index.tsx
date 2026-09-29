import "@canva/app-ui-kit/styles.css";

import { AppI18nProvider } from "@canva/app-i18n-kit";
import { AppUiProvider } from "@canva/app-ui-kit";
import type { DesignEditorIntent } from "@canva/intents/design";
import { createRoot } from "react-dom/client";

import { App } from "./app";

async function render() {
  const rootElement = document.getElementById("root");
  if (!(rootElement instanceof Element)) {
    throw new Error("Unable to find the Canva app root element.");
  }

  createRoot(rootElement).render(
    <AppI18nProvider>
      <AppUiProvider>
        <App />
      </AppUiProvider>
    </AppI18nProvider>,
  );
}

const designEditor: DesignEditorIntent = { render };
export default designEditor;
