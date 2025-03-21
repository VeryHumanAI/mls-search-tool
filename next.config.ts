import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Publicly accessible env variables (safe to expose to the browser)
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Environment variables that should only be available on the server
  serverRuntimeConfig: {
    NEXT_RAPIDAPI_HOST: process.env.NEXT_RAPIDAPI_HOST,
    NEXT_RAPIDAPI_KEY: process.env.NEXT_RAPIDAPI_KEY,
  },
  // Improve static analysis and optimization
  reactStrictMode: true,
  // Add image optimization for property images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "**.rdcpix.com",
      },
      {
        protocol: "https",
        hostname: "**.openstreetmap.org",
      },
    ],
  },
};

export default nextConfig;
