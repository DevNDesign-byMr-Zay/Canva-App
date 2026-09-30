import { getTemporaryUrl, type ImageRef } from "@canva/asset";
import { selection } from "@canva/design";
import { useEffect, useRef, useState } from "react";

export type CanvaImageSelection = Readonly<{
  count: number;
  ref: ImageRef | null;
  previewUrl: string | null;
  error: string | null;
}>;

const EMPTY: CanvaImageSelection = Object.freeze({
  count: 0,
  ref: null,
  previewUrl: null,
  error: null,
});

export function useCanvaImageSelection(): CanvaImageSelection {
  const [state, setState] = useState<CanvaImageSelection>(EMPTY);
  const version = useRef(0);

  useEffect(() => {
    return selection.registerOnChange({
      scope: "image",
      onChange: async (event) => {
        const current = ++version.current;

        if (event.count !== 1) {
          setState(
            Object.freeze({
              count: event.count,
              ref: null,
              previewUrl: null,
              error:
                event.count > 1
                  ? "Select exactly one raster image to use it as a HoloForge source."
                  : null,
            }),
          );
          return;
        }

        try {
          const draft = await event.read();
          const ref = draft.contents[0]?.ref ?? null;
          if (!ref) {
            setState(
              Object.freeze({
                count: event.count,
                ref: null,
                previewUrl: null,
                error: "The selected item does not expose a raster image reference.",
              }),
            );
            return;
          }

          const { url } = await getTemporaryUrl({ type: "image", ref });
          if (version.current !== current) return;

          setState(
            Object.freeze({
              count: 1,
              ref,
              previewUrl: url,
              error: null,
            }),
          );
        } catch (cause) {
          if (version.current !== current) return;
          setState(
            Object.freeze({
              count: 1,
              ref: null,
              previewUrl: null,
              error:
                cause instanceof Error
                  ? cause.message
                  : "HoloForge could not read the selected Canva image.",
            }),
          );
        }
      },
    });
  }, []);

  return state;
}
