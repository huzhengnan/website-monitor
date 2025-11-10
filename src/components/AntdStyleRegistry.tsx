import { AntdRegistry } from '@ant-design/nextjs-registry';
import React from 'react';

// Server Component wrapper for Ant Design CSS-in-JS registry.
// Keeps style insertion and cleanup managed on the server side.
export default function AntdStyleRegistry({ children }: { children: React.ReactNode }) {
  return <AntdRegistry>{children}</AntdRegistry>;
}

