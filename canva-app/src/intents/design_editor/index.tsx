import "@canva/app-ui-kit/styles.css";

import { AppI18nProvider } from "@canva/app-i18n-kit";
import { AppUiProvider } from "@canva/app-ui-kit";
import type { DesignEditorIntent } from "@canva/intents/design";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import type { ProductSurface } from "./navigation/product-switcher";
import { resolveReviewContextForMount } from "./review-context-mount";

const runtime = globalThis as typeof globalThis & {
  __MRZAY_CANVA_PRODUCT__?: ProductSurface;
};
const configuredProduct =
  runtime.__MRZAY_CANVA_PRODUCT__ === "holoforge" ||
  runtime.__MRZAY_CANVA_PRODUCT__ === "depthpop"
    ? runtime.__MRZAY_CANVA_PRODUCT__
    : null;

async function render() {
  const rootElement = document.getElementById("root");

  if (!(rootElement instanceof Element)) {
    throw new Error("Unable to find the Canva app root element.");
  }

  const root = createRoot(rootElement);

  const trustedContext = await resolveReviewContextForMount();

  root.render(
    <AppI18nProvider>
      <AppUiProvider>
        <App
          scenario={trustedContext?.scenario ?? null}
          trustedDesignId={trustedContext?.trustedDesignId}
          trustedPageId={trustedContext?.trustedPageId}
          initialProduct={configuredProduct ?? "holoforge"}
          lockedProduct={configuredProduct}
        />
      </AppUiProvider>
    </AppI18nProvider>,
  );
}

const designEditor: DesignEditorIntent = { render };

export default designEditor;
