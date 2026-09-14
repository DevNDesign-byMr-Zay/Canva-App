export type TrustedDesignIdentity = {
  designId: string;
  appId?: string;
};

export type FreshDesignTokenProvider = () => Promise<string>;
export type TrustedDesignIdentityResolver = (
  freshDesignToken: string,
) => Promise<TrustedDesignIdentity>;

/**
 * Bridges Canva's fresh design token to an upstream/backend verification seam.
 * The token is opaque here: this module never decodes or verifies JWT contents.
 */
export async function resolveTrustedDesignIdentity(
  getFreshDesignToken: FreshDesignTokenProvider,
  resolveWithBackend: TrustedDesignIdentityResolver,
): Promise<TrustedDesignIdentity> {
  const token = (await getFreshDesignToken()).trim();
  if (!token) {
    throw new Error("Canva did not provide a fresh design token.");
  }

  const identity = await resolveWithBackend(token);
  const designId = identity.designId.trim();

  if (!designId) {
    throw new Error("The trusted identity resolver did not return a design ID.");
  }

  return {
    designId,
    ...(identity.appId?.trim() ? { appId: identity.appId.trim() } : {}),
  };
}
