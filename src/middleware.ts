import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host") || "";

  // 1. SHIELDING SECURITY: Superadmin Route Protection
  if (url.pathname.startsWith("/superadmin")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || "super-secret-lotre-saas-key-12345"
    });

    // If no active session or role is not SUPERADMIN, redirect to login page
    if (!token || token.role !== "SUPERADMIN") {
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
  }

  // 2. ROUTING ARCHITECTURE: Multi-Tenant Subdomain Rewrites
  const cleanHost = hostname.split(":")[0].toLowerCase();

  // Get configured main domain from NEXTAUTH_URL environment variable, fallback to "lotre.com"
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  let mainDomain = "lotre.com";
  try {
    if (nextAuthUrl) {
      mainDomain = new URL(nextAuthUrl).hostname.toLowerCase();
    }
  } catch (e) {
    // Keep fallback
  }

  // Exclude raw IPs, localhost, or single-label names (.local)
  const isIPAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(cleanHost);
  const isLocalhost = cleanHost === "localhost" || cleanHost.endsWith(".local");
  
  let isMainDomain = false;
  let tenantSlug = "";

  if (isIPAddress || isLocalhost) {
    isMainDomain = true;
  } else if (cleanHost === mainDomain || cleanHost === `www.${mainDomain}`) {
    isMainDomain = true;
  } else if (cleanHost.endsWith(`.${mainDomain}`)) {
    // E.g. cleanHost = "rt05.arisan.domainanda.com", mainDomain = "arisan.domainanda.com"
    // tenantSlug is "rt05"
    tenantSlug = cleanHost.slice(0, cleanHost.length - mainDomain.length - 1);
    
    // Ignore "www" or empty tenant slugs
    if (tenantSlug === "www" || !tenantSlug) {
      isMainDomain = true;
      tenantSlug = "";
    }
  } else {
    // If accessed via another unknown domain/host directly, default to main domain to avoid 404
    isMainDomain = true;
  }

  if (!isMainDomain && tenantSlug) {
    // Perform transparent internal rewrite to dynamic [tenant] folders
    // Path /dashboard on "tenant-slug.domain.com" -> /_tenants/tenant-slug/dashboard internally
    url.pathname = `/_tenants/${tenantSlug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Optimized Matcher Config to skip static files, assets, images, and API routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - any files with extensions (e.g. public images, logo.png, manifest.json)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
