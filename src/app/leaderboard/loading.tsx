import { Skeleton } from 'antd';

export default function LoadingLeaderboard() {
  return (
    <div style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 3 }} />
      <div style={{ height: 12 }} />
      <Skeleton active paragraph={{ rows: 12 }} />
    </div>
  );
}

