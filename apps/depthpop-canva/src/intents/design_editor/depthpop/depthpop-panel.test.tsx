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
  it("matches the maintained Drive v115 DepthPop labels and quality presets", () => {
    const html = render(<DepthPopPanel snapshot={null} isReading={false} onRefresh={vi.fn()} />);
    expect(html).toContain("DEPTHPOP");
    expect(html).toContain("DEPTH POP");
    expect(html).toContain("Turn depth into presence");
    expect(html).toContain("Depth Strength (subject pop)");
    expect(html).toContain("Depth Blur (background softness)");
    expect(html).toContain("Depth Fidelity (depth-map accuracy)");
    expect(html).toContain("Render Quality");
    expect(html).toContain("Fast");
    expect(html).toContain("Balanced");
    expect(html).toContain("Cinematic");
    expect(html).toContain("EXECUTE DEPTHPOP");
    expect(html).not.toContain("Focus point");
    expect(html).not.toContain("Edge lift");
  });

  it("surfaces current Canva snapshot context compactly", () => {
    const html = render(
      <DepthPopPanel
        snapshot={{
          designTitle: "Campaign cover",
          pageId: "page-1",
          elementCount: 1,
        }}
        isReading={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(html).toContain("Campaign cover");
    expect(html).toContain("1 element");
    expect(html).toContain("Refresh");
  });
});
