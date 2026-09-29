import { getCurrentPageMetadata, getDesignMetadata, openDesign } from "@canva/design";

export type DepthPopSourceSnapshot = Readonly<{
  designTitle?: string;
  pageId: string;
  elementCount: number;
}>;

export async function readDepthPopSourceSnapshot(): Promise<DepthPopSourceSnapshot> {
  const [{ title }, pageMetadata] = await Promise.all([
    getDesignMetadata(),
    getCurrentPageMetadata(),
  ]);

  if (pageMetadata.type !== "absolute" || !pageMetadata.id) {
    throw new Error("DepthPop requires a Canva design page that exposes stable design content.");
  }

  let elementCount = 0;
  await openDesign({ type: "current_page" }, async (session) => {
    if (session.page.type !== "absolute" || session.page.id !== pageMetadata.id) {
      throw new Error("The Canva page changed while DepthPop was reading it.");
    }
    elementCount = session.page.elements.toArray().length;
  });

  return Object.freeze({
    designTitle: title || undefined,
    pageId: pageMetadata.id,
    elementCount,
  });
}
