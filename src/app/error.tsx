'use client';

import { Button, Result } from 'antd';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ padding: 24 }}>
          <Result
            status="500"
            title="出错了"
            subTitle={process.env.NODE_ENV === 'development' ? error?.message : '服务器开小差，请稍后再试'}
            extra={<Button type="primary" onClick={reset}>重试</Button>}
          />
        </div>
      </body>
    </html>
  );
}

