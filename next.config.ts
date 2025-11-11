import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  // 启用 SWC 最小化（更快的编译）
  swcMinify: true,
  // 启用实验性功能
  experimental: {
    // 优化包大小
    optimizePackageImports: ["antd", "@ant-design/pro-components"],
  },
  // 禁用 Source Maps 在生产环境中加快构建
  productionBrowserSourceMaps: false,
  // 优化编译
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 1 分钟
    pagesBufferLength: 5,
  },
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
