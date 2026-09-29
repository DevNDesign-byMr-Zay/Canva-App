import React from "react";
import { renderToString } from "react-dom/server";
import { createIntl, createIntlCache, RawIntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import { DepthPopPanel } from "./depthpop-panel";

vi.mock("@canva/app-ui-kit", async () => {
  const ReactModule = await import("react");
  const element = (
    tag: string,
    displayName: string,
  ): React.FC<React.PropsWithChildren<Record<string, unknown>>> => {
    const Component: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({
      children,
      ...props
    }) =>
      ReactModule.createElement(
        tag,
        Object.fromEntries(
          Object.entries(props).filter(
            ([key]) =>
              !["variant", "tone", "stretch", "loading"].includes(key) && !key.startsWith("on"),
          ),
        ),
        children,
      );
    Component.displayName = displayName;
    return Component;
  };

  return {
    Alert: element("div", "Alert"),
    Button: element("button", "Button"),
    Text: element("span", "Text"),
    Title: element("h3", "Title"),
  };
});

const intl = createIntl(
  { locale: "en", defaultLocale: "en", messages: {}, onError: () => {} },
  createIntlCache(),
);
Object.defineProperty(intl, "formatMessage", {
  configurable: true,
  value: (descriptor: { defaultMessage?: unknown; id?: string }) =>
    String(descriptor.defaultMessage ?? descriptor.id ?? ""),
});

function render(node: React.ReactNode): string {
  return renderToString(<RawIntlProvider value={intl}>{node}</RawIntlProvider>);
}

describe("DepthPop Canva UI", () => {
  it("renders the dedicated DepthPop product surface instead of legacy AETHER chrome", () => {
    const html = render(<DepthPopPanel snapshot={null} isReading={false} onRefresh={vi.fn()} />);
    expect(html).toContain("DepthPop");
    expect(html).toContain("Depth strength");
    expect(html).toContain("Bokeh");
    expect(html).toContain("Focus point");
    expect(html).toContain("APPLY DEPTHPOP");
    expect(html).not.toContain("Message AETHER");
    expect(html).not.toContain("R.O.A.R.Y Studio");
  });

  it("surfaces current Canva snapshot context when available", () => {
    const html = render(
      <DepthPopPanel
        snapshot={{
          designTitle: "Campaign cover",
          designId: "design-1",
          pageId: "page-1",
          pageType: "absolute",
          pageDimensions: { width: 1080, height: 1080 },
          elements: [
            {
              id: "element-1",
              type: "image",
              top: 0,
              left: 0,
              width: 1080,
              height: 1080,
              rotation: 0,
              locked: false,
            },
          ],
          fingerprint: "a".repeat(64),
        }}
        isReading={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(html).toContain("Campaign cover");
    expect(html).toContain("1 element");
    expect(html).toContain("Refresh canvas");
  });
});
