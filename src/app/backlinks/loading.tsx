import { Skeleton } from 'antd';

export default function LoadingBacklinks() {
  return (
    <div style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 3 }} />
      <div style={{ height: 12 }} />
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );
}

