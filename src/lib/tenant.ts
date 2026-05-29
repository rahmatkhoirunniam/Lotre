import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import db from "@/lib/db";

/**
 * Resolves the tenantId for an incoming request.
 * Priority: 1) tenantSlug query param (with ownership validation if authenticated), 
 *           2) authenticated session tenantId.
 * Returns null if neither can be resolved.
 */
export async function resolveTenantId(tenantSlug?: string | null): Promise<string | null> {
  const session = await getServerSession(authOptions);

  // If a slug is supplied, resolve by slug and verify ownership if logged in
  if (tenantSlug) {
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, ownerId: true },
    });

    if (tenant) {
      // If user is logged in, ensure they own it
      if (session?.user) {
        if (tenant.ownerId === session.user.id) {
          return tenant.id;
        } else {
          // Exception: allow default public demo slugs for exploration
          if (tenantSlug === "keluarga-cemara" || tenantSlug === "rt-05") {
            return tenant.id;
          }
          return null;
        }
      }
      return tenant.id;
    }
  }

  // Fallback to session tenantId if no slug is provided
  if (session?.user?.tenantId) {
    return session.user.tenantId;
  }

  return null;
}

/**
 * Resolves tenantId + slug for export/display purposes.
 * Returns null if tenant cannot be resolved.
 */
export async function resolveTenant(
  tenantSlug?: string | null
): Promise<{ id: string; slug: string } | null> {
  const session = await getServerSession(authOptions);

  if (tenantSlug) {
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, ownerId: true },
    });

    if (tenant) {
      if (session?.user && tenant.ownerId !== session.user.id) {
        if (tenantSlug === "keluarga-cemara" || tenantSlug === "rt-05") {
          return { id: tenant.id, slug: tenant.slug };
        }
        return null;
      }
      return { id: tenant.id, slug: tenant.slug };
    }
  }

  if (session?.user?.tenantId) {
    const tenant = await db.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { id: true, slug: true },
    });
    return tenant ?? null;
  }

  return null;
}
