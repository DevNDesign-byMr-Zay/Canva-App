import React from "react";
import { createIntl, createIntlCache, RawIntlProvider } from "react-intl";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProductSwitcher } from "./product-switcher";

const intl = createIntl(
  { locale: "en", defaultLocale: "en", messages: {}, onError: () => {} },
  createIntlCache(),
);
Object.defineProperty(intl, "formatMessage", {
  configurable: true,
  value: (descriptor: { defaultMessage?: unknown; id?: string }) =>
    String(descriptor.defaultMessage ?? descriptor.id ?? ""),
});

function children(node: React.ReactElement): React.ReactElement[] {
  return React.Children.toArray((node.props as { children?: React.ReactNode }).children).filter(
    React.isValidElement,
  ) as React.ReactElement[];
}

describe("Canva product switcher", () => {
  it("renders HoloForge and DepthPop", () => {
    const html = renderToString(
      <RawIntlProvider value={intl}>
        <ProductSwitcher activeProduct="holoforge" onSelectProduct={vi.fn()} />
      </RawIntlProvider>,
    );
    expect(html).toContain("HoloForge");
    expect(html).toContain("DepthPop");
  });

  it("routes both product selections", () => {
    const onSelectProduct = vi.fn();
    const tree = ProductSwitcher({
      activeProduct: "holoforge",
      onSelectProduct,
    }) as React.ReactElement;
    const [holo, depth] = children(tree);
    (holo.props as { onClick?: () => void }).onClick?.();
    (depth.props as { onClick?: () => void }).onClick?.();
    expect(onSelectProduct).toHaveBeenNthCalledWith(1, "holoforge");
    expect(onSelectProduct).toHaveBeenNthCalledWith(2, "depthpop");
  });
});
