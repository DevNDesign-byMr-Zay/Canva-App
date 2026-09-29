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

  productTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const product = tab.dataset.product;
      if (!product) return;
      setProduct(product);
      const url = new URL(window.location.href);
      url.searchParams.set("product", product);
      window.history.replaceState({}, "", url);
    });
  });

  const requestedProduct = new URLSearchParams(window.location.search).get("product");
  if (requestedProduct) setProduct(requestedProduct);

  const hfTabs = [...document.querySelectorAll("[data-hf-tab]")];
  const hfPanes = [...document.querySelectorAll("[data-hf-pane]")];
  hfTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.hfTab;
      hfTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      hfPanes.forEach((pane) => pane.classList.toggle("is-active", pane.dataset.hfPane === id));
    });
  });

  const materialButtons = [...document.querySelectorAll(".material")];
  const materialName = document.getElementById("material-name");
  materialButtons.forEach((button) => {
    button.addEventListener("click", () => {
      materialButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (materialName) materialName.textContent = button.textContent?.trim() || "";
    });
  });

  const bindPercent = (id, valueId, onInput) => {
    const input = document.getElementById(id);
    const value = document.getElementById(valueId);
    input?.addEventListener("input", () => {
      if (value) value.textContent = input.value + "%";
      onInput?.(Number(input.value));
    });
  };

  bindPercent("reflection", "reflection-value", (v) => {
    const orb = document.getElementById("holo-orb");
    if (orb) orb.style.filter = `saturate(${1 + v / 180}) brightness(${0.9 + v / 350})`;
  });
  bindPercent("glow", "glow-value", (v) => {
    const orb = document.getElementById("holo-orb");
    if (orb) orb.style.boxShadow = `0 0 ${12 + v * 0.45}px rgba(94,145,255,.30), inset 0 0 20px rgba(255,255,255,.25)`;
  });
  bindPercent("transparency", "transparency-value", (v) => {
    const orb = document.getElementById("holo-orb");
    if (orb) orb.style.opacity = String(1 - v / 180);
  });

  const strength = document.getElementById("depth-strength");
  const blur = document.getElementById("depth-blur");
  const fidelity = document.getElementById("depth-fidelity");
  strength?.addEventListener("input", () => {
    const out = document.getElementById("depth-strength-value");
    if (out) out.textContent = Number(strength.value).toFixed(2);
  });
  blur?.addEventListener("input", () => {
    const out = document.getElementById("depth-blur-value");
    if (out) out.textContent = Math.round(Number(blur.value)) + "%";
  });
  fidelity?.addEventListener("input", () => {
    const out = document.getElementById("depth-fidelity-value");
    if (out) out.textContent = Number(fidelity.value).toFixed(2);
  });

  document.querySelectorAll("[data-quality]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-quality]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      const steps = document.getElementById("quality-steps");
      if (steps) steps.textContent = `steps ${button.dataset.steps || "22"}`;
    });
  });
})();
