import type { NextConfig } from "next";

/**
 * Dev-only. Next.js blocks cross-origin requests to dev assets (JS chunks,
 * HMR) for hosts other than the one the dev server was started with. The
 * ngrok and Cloudflare Quick Tunnel URLs are ephemeral, so allow their
 * wildcard domains plus the usual local hosts instead of hardcoding one
 * tunnel URL.
 */
const allowedDevOrigins = [
  "localhost",
  "127.0.0.1",
  "192.168.1.8",
  "*.ngrok-free.dev",
  "*.trycloudflare.com",
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  /*
   * The qpdf binary is invoked by path (not imported), so Next.js's file
   * tracing won't include it in serverless bundles by default. Force the
   * bundled Linux qpdf + libs into every function so PDF encryption works
   * on Vercel.
   */
  outputFileTracingIncludes: {
    "/*": ["./bin/qpdf-linux/**"],
  },
};

export default nextConfig;
