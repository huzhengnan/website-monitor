import { NextRequest, NextResponse } from 'next/server';

/**
 * 测试代理配置是否正确
 * GET /api/proxy-test
 */
export async function GET(request: NextRequest) {
  const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  const useProxy = process.env.USE_PROXY === 'true' || !!proxyUrl;

  const response = {
    success: true,
    proxyConfig: {
      HTTP_PROXY: process.env.HTTP_PROXY || 'not set',
      HTTPS_PROXY: process.env.HTTPS_PROXY || 'not set',
      USE_PROXY: process.env.USE_PROXY || 'not set',
      PROXY_URL: process.env.PROXY_URL || 'not set',
      effectiveProxy: proxyUrl || 'no proxy configured',
      isProxyEnabled: useProxy,
    },
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'not set',
    message: useProxy
      ? `✅ 代理已配置: ${proxyUrl}`
      : '⚠️ 代理未配置，请在 .env.local 中设置 HTTP_PROXY 或 HTTPS_PROXY',
  };

  console.log('[Proxy Test]', JSON.stringify(response.proxyConfig, null, 2));

  return NextResponse.json(response);
}
