import { Skeleton } from 'antd';

export default function LoadingSites() {
  return (
    <div style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 2 }} />
      <div style={{ height: 12 }} />
      <Skeleton active paragraph={{ rows: 10 }} />
    </div>
  );
}

