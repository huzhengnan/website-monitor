"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProLayout } from '@ant-design/pro-components';
import {
  HomeOutlined,
  GlobalOutlined,
  LinkOutlined,
  TrophyOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Segmented, FloatButton } from 'antd';
import { useTheme } from './ThemeContext';
import { NotificationManager } from './NotificationProvider';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const route = {
    path: '/',
    routes: [
      { path: '/', name: '首页', icon: <HomeOutlined /> },
      { path: '/sites', name: '我的站点', icon: <GlobalOutlined /> },
      { path: '/backlinks', name: '外链管理', icon: <LinkOutlined /> },
      { path: '/leaderboard', name: '排行榜', icon: <TrophyOutlined /> },
      { path: '/analytics', name: '数据分析', icon: <BarChartOutlined /> },
      { path: '/settings', name: '设置', icon: <SettingOutlined /> },
    ],
  } as const;

  // Avoid hydration mismatch: render a stable shell until mounted
  useEffect(() => {
    setMounted(true);
    try {
      const v = window.localStorage.getItem('sider-collapsed');
      setCollapsed(v === '1');
    } catch {}
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NotificationManager />
      <ProLayout
        title="网站管理平台"
        logo={null}
        layout="mix"
        fixedHeader
        fixSiderbar
        collapsed={collapsed}
        onCollapse={(c) => { setCollapsed(c); try { window.localStorage.setItem('sider-collapsed', c ? '1' : '0'); } catch {} }}
        route={route as any}
        location={{ pathname }}
        menuItemRender={(item, dom) =>
          item.path ? (
            <Link href={item.path} prefetch={false}>
              {dom}
            </Link>
          ) : (
            dom
          )
        }
        token={{
          header: {
            colorBgHeader: 'var(--card)',
            colorTextMenu: 'var(--foreground)',
            colorTextMenuSecondary: 'var(--muted-foreground)',
            colorTextMenuSelected: '#4f46e5',
            colorBgMenuItemSelected: 'transparent',
          },
          sider: {
            colorMenuBackground: 'var(--card)',
            colorTextMenu: 'var(--foreground)',
            colorTextMenuSelected: '#4f46e5',
            colorBgMenuItemSelected: 'rgba(79,70,229,0.12)',
          },
          pageContainer: {
            colorBgPageContainer: 'var(--background)',
          },
        }}
        rightContentRender={() => {
          const { mode, setMode } = useTheme();
          return (
            <Segmented
              size="small"
              value={mode}
              options={[
                { label: '系统', value: 'system', icon: <i className="anticon"><svg width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M6 3h12a3 3 0 0 1 3 3v9H3V6a3 3 0 0 1 3-3m15 15H3a1 1 0 0 0 0 2h18a1 1 0 1 0 0-2"/></svg></i> },
                { label: '明亮', value: 'light', icon: <i className="anticon"><svg width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 18a6 6 0 1 1 6-6a6 6 0 0 1-6 6m0-16a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1m0 18a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1M2 13a1 1 0 0 1-1-1a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2zm19 0a1 1 0 1 1 0-2h1a1 1 0 0 1 0 2zM4.22 5.64a1 1 0 0 1 1.42 0l.71.7a1 1 0 0 1-1.41 1.42l-.72-.71a1 1 0 0 1 0-1.41m12.73.7l.7-.7a1 1 0 0 1 1.42 1.41l-.71.72a1 1 0 0 1-1.41-1.42M4.22 18.36a1 1 0 1 1 1.41-1.41l.72.71a1 1 0 0 1-1.42 1.42zM17.66 19.07a1 1 0 1 1 1.41-1.41l.72.71a1 1 0 0 1-1.41 1.42z"/></svg></i> },
                { label: '暗黑', value: 'dark', icon: <i className="anticon"><svg width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M18 12a6 6 0 0 1-7.75 5.75a7 7 0 1 0 7.75-7.75z"/></svg></i> },
              ]}
              onChange={(v) => setMode(v as any)}
            />
          );
        }}
        footerRender={() => (
          <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '16px 0' }}>
            网站管理平台 v1.0 © 2024
          </div>
        )}
      >
        <div style={{ padding: 16 }}>{children}</div>
      </ProLayout>
      <FloatButton.BackTop />
    </div>
  );
}
