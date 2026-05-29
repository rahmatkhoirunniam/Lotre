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
  // Split hostname to identify subdomain (e.g. "keluarga-cemara.lotre.com")
  const hostnameParts = hostname.split(".");
  const subdomain = hostnameParts[0];

  // Define host exclusions (root, www, localhost developers)
  const isMainDomain =
    hostname === "lotre.com" ||
    hostname.startsWith("localhost") ||
    subdomain === "www" ||
    subdomain === "";

  if (!isMainDomain && subdomain) {
    // Perform transparent internal rewrite to dynamic [tenant] folders
    // Path /dashboard on "tenant-slug.lotre.com" -> /_tenants/tenant-slug/dashboard internally
    url.pathname = `/_tenants/${subdomain}${url.pathname}`;
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
