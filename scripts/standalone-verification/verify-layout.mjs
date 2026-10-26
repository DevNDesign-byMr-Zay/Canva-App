import fs from "node:fs";
import path from "node:path";

export function verifyLayout({ root, APPS, full, readText, fail }) {
for (const [name, spec] of Object.entries(APPS)) {
  for (const rel of spec.required) {
    const file = full(spec.root, rel);
    if (!fs.existsSync(file)) {
      fail(`${name}: missing required file ${rel}`);
      continue;
    }
    if (fs.statSync(file).isFile() && fs.statSync(file).size === 0) {
      fail(`${name}: required file is empty ${rel}`);
    }
  }

  const manifestPath = full(spec.root, "canva-app.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(readText(manifestPath));
    if (manifest?.intent?.design_editor?.enrolled !== true) {
      fail(`${name}: Canva Design Editor intent is not enrolled`);
    }
    const permissions = new Set(
      (manifest?.runtime?.permissions ?? []).map((permission) => permission?.name),
    );
    const requiredPermissions = [
      "canva:design:content:read",
      "canva:design:content:write",
      "canva:asset:private:write",
    ];
    requiredPermissions.push("canva:asset:private:read");
    for (const requiredPermission of requiredPermissions) {
      if (!permissions.has(requiredPermission)) {
        fail(`${name}: missing Canva permission ${requiredPermission}`);
      }
    }
  }

  const packagePath = full(spec.root, "package.json");
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(readText(packagePath));
    for (const scriptName of ["build", "typecheck", "test"]) {
      if (!pkg?.scripts?.[scriptName]) {
        fail(`${name}: package.json is missing ${scriptName} script`);
      }
    }
    const requiredDependencies =
      name === "holoforge"
        ? ["@canva/asset", "@canva/design", "@canva/user", "three", "@react-three/fiber", "@react-three/drei"]
        : ["@canva/asset", "@canva/design"];
    for (const dependency of requiredDependencies) {
      if (!pkg?.dependencies?.[dependency]) {
        fail(`${name}: package.json is missing ${dependency} required for test-image upload/add-to-design`);
      }
    }
  }

  const preview = full(spec.root, "preview/index.html");
  if (fs.existsSync(preview)) {
    const previewText = readText(preview);
    if (!previewText.includes("../" + spec.logo)) {
      fail(`${name}: preview does not reference packaged logo ${spec.logo}`);
    }
    if (
      !previewText.includes("type=\"file\"") ||
      !previewText.includes('accept="image/png,image/jpeg,image/webp"')
    ) {
      fail(`${name}: preview is missing its local PNG/JPEG/WebP file picker`);
    }
  }

  const sourceRoot = full(spec.root, "src");
  if (fs.existsSync(sourceRoot)) {
    const queue = [sourceRoot];
    while (queue.length) {
      const current = queue.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const item = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(item);
        } else if (/\.(?:ts|tsx|js|jsx|css|html)$/u.test(entry.name)) {
          const source = readText(item);
          for (const forbidden of spec.forbiddenText) {
            if (source.includes(forbidden)) {
              fail(
                `${name}: forbidden cross-product/runtime-switcher reference "${forbidden}" in ${path.relative(root, item)}`,
              );
            }
          }
        }
      }
    }
  }

  const uploadSource = full(spec.root, "src/intents/design_editor/local-image-upload.tsx");
  if (fs.existsSync(uploadSource)) {
    const uploadText = readText(uploadSource);
    for (const marker of [
      "CHOOSE IMAGE",
      "readAsDataUrl",
      "uploadDataUrlToCanva",
      "MAX_DATA_URL_CHARACTERS",
      "await upload({",
      "name: input.fileName",
      "await asset.whenUploaded()",
      "await addElementAtPoint({",
      "insertIntoDesign",
      "htmlFor={inputId}",
      "onDrop=",
      'accept="image/png,image/jpeg,image/webp"',
      "7 * 1024 * 1024",
      "10 * 1024 * 1024",
    ]) {
      if (!uploadText.includes(marker)) {
        fail(`${name}: test-image upload marker missing: ${marker}`);
      }
    }
  }
}

}
