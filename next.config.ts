import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./processor/**/*"],
  },
};

export default nextConfig;
