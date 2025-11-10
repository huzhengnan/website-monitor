import type { Metadata } from "next";
import "./globals.css";
import Layout from "@/components/Layout";
import AntdProvider from "@/components/AntdProvider";
import AntdStyleRegistry from "@/components/AntdStyleRegistry";

export const metadata: Metadata = {
  title: "网站管理平台",
  description: "统一管理你的网站数据，流量与评分一览无余",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdStyleRegistry>
          <AntdProvider>
            <Layout>{children}</Layout>
          </AntdProvider>
        </AntdStyleRegistry>
      </body>
    </html>
  );
}
