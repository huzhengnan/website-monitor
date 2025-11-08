'use client';

import Link from 'next/link';

interface SiteIdInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showHelper?: boolean;
}

export function SiteIdInput({
  value,
  onChange,
  placeholder = '输入你的站点 UUID (如: 550e8400-e29b-41d4-a716-446655440000)',
  showHelper = true,
}: SiteIdInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        站点 ID
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {showHelper && (
        <p className="text-xs text-gray-500 mt-2">
          站点 ID 应该是一个有效的 UUID 格式（36 个字符，包括连字符）。你可以在
          <Link href="/sites" className="text-blue-600 hover:underline ml-1 mr-1">
            站点列表
          </Link>
          找到站点 UUID。
        </p>
      )}
    </div>
  );
}
