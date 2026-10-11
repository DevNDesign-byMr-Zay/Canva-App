export type DepthTextureResolver = (
  assetUrl: string,
  signal?: AbortSignal,
) => Promise<string>;

export type DepthTextureRevoker = (blobUrl: string) => void;

function isInlineImageUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("blob:");
}

function defaultRevoker(url: string): void {
  URL.revokeObjectURL(url);
}

export class DepthTextureCache {
  private readonly resolved = new Map<string, string>();
  private readonly pending = new Map<string, Promise<string>>();
  private readonly ownedBlobUrls = new Set<string>();
  private disposed = false;

  constructor(
    private readonly resolver: DepthTextureResolver,
    private readonly revoke: DepthTextureRevoker = defaultRevoker,
  ) {}

  async resolve(assetUrl: string, signal?: AbortSignal): Promise<string> {
    if (isInlineImageUrl(assetUrl)) return assetUrl;
    if (this.disposed) {
      throw new Error("DepthPop texture cache was disposed.");
    }

    const cached = this.resolved.get(assetUrl);
    if (cached) return cached;

    const existing = this.pending.get(assetUrl);
    if (existing) return existing;

    const request = this.resolver(assetUrl, signal)
      .then((resolvedUrl) => {
        if (this.disposed) {
          if (resolvedUrl.startsWith("blob:")) {
            this.revoke(resolvedUrl);
          }
          throw new Error("DepthPop texture cache was disposed.");
        }
        this.resolved.set(assetUrl, resolvedUrl);
        if (resolvedUrl.startsWith("blob:")) {
          this.ownedBlobUrls.add(resolvedUrl);
        }
        return resolvedUrl;
      })
      .finally(() => {
        this.pending.delete(assetUrl);
      });

    this.pending.set(assetUrl, request);
    return request;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const blobUrl of this.ownedBlobUrls) {
      this.revoke(blobUrl);
    }
    this.ownedBlobUrls.clear();
    this.resolved.clear();
  }
}
