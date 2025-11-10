"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { ThemeProvider, useTheme } from './ThemeContext';

type Props = { children: React.ReactNode };

function Inner({ children }: Props) {
  const { isDark, mode } = useTheme();
  const algo = isDark ? theme.darkAlgorithm : theme.defaultAlgorithm;
  const cfg = useMemo(() => ({
    token: { colorPrimary: '#4f46e5', borderRadius: 8 },
    algorithm: algo,
  }), [algo]);
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (mode === 'system') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
  }, [isDark, mode]);
  // set dayjs locale
  dayjs.locale('zh-cn');
  return (
    <ConfigProvider theme={cfg} componentSize="middle" locale={zhCN}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}

export default function AntdProvider({ children }: Props) {
  return (
    <ThemeProvider>
      <Inner>{children}</Inner>
    </ThemeProvider>
  );
}
