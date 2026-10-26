import { verifyStandaloneApps } from "./standalone-verification/index.mjs";

const failures = verifyStandaloneApps();
if (failures.length) {
  console.error("\nStandalone Canva app verification failed:\n");
  for (const message of failures) console.error(" - " + message);
  process.exit(1);
}

console.log("Standalone Canva app verification passed.");
console.log(" - HoloForge: independent app + real WebGL scene + transforms + spectral/keyframe runtime + explicit export capability contracts + Canva forge routes");
console.log(" - DepthPop: independent app + embedded/packaged logo + Canva test-image upload + Drive v115 processing contract");
console.log(" - DepthPop backend: auth, provider, render, cache, tests, Docker and deployment files present");
console.log(" - No shared HoloForge/DepthPop product-switch runtime detected");
console.log(" - User-facing packages exclude historical ROARY/ÆTHER shell and Drive provenance source files");
