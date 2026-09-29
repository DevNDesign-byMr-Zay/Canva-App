(() => {
  const productTabs = [...document.querySelectorAll(".product-tab")];
  const productViews = {
    holoforge: document.getElementById("holoforge-view"),
    depthpop: document.getElementById("depthpop-view"),
  };

  const setProduct = (product) => {
    if (!(product in productViews)) return;
    productTabs.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.product === product);
    });
    Object.entries(productViews).forEach(([key, view]) => {
      view?.classList.toggle("is-active", key === product);
    });
  };

  for (const tab of productTabs) {
    tab.addEventListener("click", () => {
      const product = tab.dataset.product;
      if (!product) return;
      setProduct(product);
      const url = new URL(window.location.href);
      url.searchParams.set("product", product);
      window.history.replaceState({}, "", url);
    });
  }

  const requestedProduct = new URLSearchParams(window.location.search).get("product");
  if (requestedProduct) setProduct(requestedProduct);

  const hfTabs = [...document.querySelectorAll("[data-hf-tab]")];
  const hfPanes = [...document.querySelectorAll("[data-hf-pane]")];
  for (const tab of hfTabs) {
    tab.addEventListener("click", () => {
      const id = tab.dataset.hfTab;
      hfTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      hfPanes.forEach((pane) => pane.classList.toggle("is-active", pane.dataset.hfPane === id));
    });
  }

  const materialButtons = [...document.querySelectorAll(".material")];
  const materialName = document.getElementById("material-name");
  for (const button of materialButtons) {
    button.addEventListener("click", () => {
      materialButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (materialName) materialName.textContent = button.textContent?.trim() || "";
    });
  }

  const pair = (id, valueId, onInput) => {
    const input = document.getElementById(id);
    const value = document.getElementById(valueId);
    input?.addEventListener("input", () => {
      if (value) value.textContent = input.value + "%";
      onInput?.(Number(input.value));
    });
  };

  pair("reflection", "reflection-value", (v) => {
    const orb = document.getElementById("holo-orb");
    if (orb) orb.style.filter = `saturate(${1 + v / 180}) brightness(${0.9 + v / 350})`;
  });
  pair("glow", "glow-value", (v) => {
    const orb = document.getElementById("holo-orb");
    if (orb) {
      orb.style.boxShadow = `0 0 ${18 + v * 0.65}px rgba(94,145,255,${0.15 + v / 260}), inset 0 0 35px rgba(255,255,255,.32)`;
    }
  });
  pair("transparency", "transparency-value", (v) => {
    const orb = document.getElementById("holo-orb");
    if (orb) orb.style.opacity = String(1 - v / 180);
  });

  const depthStage = document.querySelector(".depth-stage");
  const summary = document.getElementById("depth-summary");
  const state = { depth: 62, bokeh: 38, focus: 42, edge: 28 };

  const updateDepth = () => {
    const d = state.depth / 100;
    const b = state.bokeh / 100;
    if (depthStage) {
      depthStage.style.setProperty("--depth-back-scale", String(0.985 - d * 0.025));
      depthStage.style.setProperty("--subject-scale", String(1 + d * 0.055));
      depthStage.style.setProperty("--front-scale", String(1.03 + d * 0.1));
      depthStage.style.setProperty("--depth-blur", `${1.5 + b * 10.5}px`);
      depthStage.style.setProperty("--focus-x", `${state.focus}%`);
      depthStage.style.setProperty(
        "--focus-opacity",
        String(0.08 + (state.edge / 100) * 0.34),
      );
    }
    if (summary) summary.textContent = `${state.depth} / ${state.bokeh} / ${state.focus}`;
  };

  pair("depth", "depth-value", (v) => {
    state.depth = v;
    updateDepth();
  });
  pair("bokeh", "bokeh-value", (v) => {
    state.bokeh = v;
    updateDepth();
  });
  pair("focus", "focus-value", (v) => {
    state.focus = v;
    updateDepth();
  });
  pair("edge", "edge-value", (v) => {
    state.edge = v;
    updateDepth();
  });
  updateDepth();

  document.querySelectorAll(".quality-row button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".quality-row button").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
    });
  });
})();
