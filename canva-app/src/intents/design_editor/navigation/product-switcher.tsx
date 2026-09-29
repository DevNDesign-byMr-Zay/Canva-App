import React from "react";
import { FormattedMessage } from "react-intl";

export type ProductSurface = "holoforge" | "depthpop";

export type ProductSwitcherProps = {
  activeProduct: ProductSurface;
  onSelectProduct: (product: ProductSurface) => void;
};

export const ProductSwitcher: React.FC<ProductSwitcherProps> = ({
  activeProduct,
  onSelectProduct,
}) => {
  return (
    <nav className="canva-product-switcher" aria-label="Mr. Zay Canva tools">
      <button
        type="button"
        className={`canva-product-tab ${activeProduct === "holoforge" ? "is-active" : ""}`}
        aria-pressed={activeProduct === "holoforge"}
        onClick={() => onSelectProduct("holoforge")}
      >
        <span className="canva-product-mark hf-product-mark" aria-hidden="true" />
        <span className="canva-product-copy">
          <strong>HoloForge</strong>
          <small>
            <FormattedMessage
              defaultMessage="Holographic studio"
              description="Subtitle for the HoloForge product selector."
            />
          </small>
        </span>
      </button>

      <button
        type="button"
        className={`canva-product-tab ${activeProduct === "depthpop" ? "is-active" : ""}`}
        aria-pressed={activeProduct === "depthpop"}
        onClick={() => onSelectProduct("depthpop")}
      >
        <span className="canva-product-mark dp-product-mark" aria-hidden="true" />
        <span className="canva-product-copy">
          <strong>DepthPop</strong>
          <small>
            <FormattedMessage
              defaultMessage="Depth + focus lab"
              description="Subtitle for the DepthPop product selector."
            />
          </small>
        </span>
      </button>
    </nav>
  );
};
