import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_DEMO_SCOPE: process.env.NEXT_PUBLIC_DEMO_SCOPE ?? "attendance",
  },
};

export default nextConfig;
