import { Result, Button } from 'antd';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <Result
        status="404"
        title="页面未找到"
        subTitle="你访问的页面不存在或已被移除"
        extra={<Link href="/"><Button type="primary">返回首页</Button></Link>}
      />
    </div>
  );
}

