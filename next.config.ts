import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  // For Turbopack in Next.js 16, use serverExternalPackages
  serverExternalPackages: ['pdfkit', 'docx', 'pdfjs-dist'],
  // Set Turbopack root to fix multiple lockfile warning
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Enable standalone output for Docker
  output: 'standalone',
};

export default nextConfig;
