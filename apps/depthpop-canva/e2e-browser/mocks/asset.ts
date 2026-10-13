export async function upload(input: unknown) {
  void input;
  return {
    ref: "e2e-browser-source-ref",
    async whenUploaded() {
      return undefined;
    },
  };
}

export async function getTemporaryUrl() {
  throw new Error("Canva selection is not used by the local-upload E2E path.");
}
