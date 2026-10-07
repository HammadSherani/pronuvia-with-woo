import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFKit loads its built-in font files from its package directory at runtime.
  // Keep it external so those files resolve from the installed package instead
  // of the Next.js server bundle.
  serverExternalPackages: ["pdfkit", "@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    // Static PDF attachments read from disk at runtime (approval/welcome
    // emails) — without this they don't exist in the Vercel serverless
    // bundle even though the mailer.ts code that reads them is fine.
    "/**": ["./generated/prisma/**", "./lib/email/attachments/**"],
  },
  images: {
    // Allow images served from the same origin (public folder uploads)
    remotePatterns: [],
    // Fallback: don't break on missing images in dev
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
  },
  experimental: {
    serverActions: {
      // Allow server actions from your Vercel domain + localhost
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "pronuvia.vercel.app",
      ],
    },
  },
};

export default nextConfig;
