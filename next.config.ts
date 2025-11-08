import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  webpack: (config, { isServer }) => {
    return config;
  },
};

export default nextConfig;
