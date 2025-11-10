import { Skeleton } from 'antd';

export default function Loading() {
  return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 4 }} />
      <div style={{ height: 16 }} />
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}

