declare module "next/types.js" {
  export type ResolvingMetadata = unknown;
  export type ResolvingViewport = unknown;
}

declare module "next/server.js" {
  import { NextRequest, NextResponse } from "next/server";
  export { NextRequest, NextResponse };
}
