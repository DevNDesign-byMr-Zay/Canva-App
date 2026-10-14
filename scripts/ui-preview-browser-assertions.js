// Executes only in the smoke harness: never shipped in a Canva app ZIP.
(async () => {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const $ = (selector) => document.querySelector(selector);
  const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const click = (selector) => {
    const control = $(selector);
    check(control, "Missing interactive control: " + selector);
    control.click();
  };
  const upload = async (inputSelector, thumbSelector) => {
    const input = $(inputSelector);
    check(input && input.type === "file", "Missing image upload");
    check(input.accept === "image/png,image/jpeg,image/webp", "Unsupported image input contract");
    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WL0S9sAAAAASUVORK5CYII=";
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = new File([bytes], "browser-smoke.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(image);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await tick(180);
    check($(thumbSelector).classList.contains("show"), "Image preview did not appear");
  };
  try {
    check($(".app") && $(".app").getBoundingClientRect().width > 200, "Canva sidebar missing");
    const logo = $(".logo-img");
    check(logo && logo.complete && logo.naturalWidth > 0, "Branded logo did not render");
    if (document.title.includes("HoloForge")) {
      check($("#create") && $("#spatial") && $("#verify"), "Missing HoloForge workspace tabs");
      click('[data-tab="spatial"]');
      check($("#spatial").classList.contains("active"), "Spatial tab did not open");
      click('[data-tab="create"]');
      click('[data-type="holo_logo"]');
      check($("#forge").disabled, "Holo Logo must require an image");
      await upload("#hf-test-file", "#hf-test-thumb");
      check(!$("#forge").disabled, "Holo Logo did not accept uploaded source");
      click('[data-type="holo_text"]');
      check($("#local-text-source").classList.contains("show"), "Holo Text source missing");
      click('[data-name="Holo Gold"]');
      check($("#receipt-material").textContent === "Holo Gold", "Material did not update");
      const slider = $('[data-out="v-shift"]');
      slider.value = "61";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      check($("#v-shift").textContent === "61%", "Material control did not update");
      click("#preview");
      check($("#spatial").classList.contains("active"), "Spatial preview did not open");
      click('[data-tab="create"]');
      click("#forge");
      check($("#verify").classList.contains("active"), "Forge confirmation did not open");
    } else if (document.title.includes("DepthPop")) {
      check($("h1")?.textContent === "DEPTHPOP", "DepthPop identity missing");
      const slider = $("#strength");
      slider.value = "0.41";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      check($("#strengthV").textContent === "0.41", "Depth slider did not update");
      await upload("#dp-test-file", "#dp-test-thumb");
      click("#execute");
      await tick(1050);
      check($("#pct").textContent === "100%", "Preview completion did not update");
      click("#reset");
      check($("#strengthV").textContent === "0.32", "Reset did not restore depth strength");
      check(!$("#progress").classList.contains("show"), "Reset did not clear progress");
    } else {
      throw new Error("Unknown Canva preview: " + document.title);
    }
    document.body.dataset.canvaBrowserSmoke = "PASS";
  } catch (error) {
    document.body.dataset.canvaBrowserSmoke = "FAIL";
    document.body.dataset.canvaBrowserError = error?.message || String(error);
  }
})();
