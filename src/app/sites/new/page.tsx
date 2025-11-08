'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import client from '@/api/client';

export default function NewSitePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    category: '',
    status: 'online' as const,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 验证必填字段
      if (!formData.name.trim()) {
        throw new Error('站点名称不能为空');
      }
      if (!formData.domain.trim()) {
        throw new Error('域名不能为空');
      }

      // 调用 API 创建站点
      const response = await client.post('/sites', {
        name: formData.name,
        domain: formData.domain,
        category: formData.category || null,
        status: formData.status,
      });

      // 创建成功，重定向到站点列表
      router.push('/sites');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建站点失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/sites" className="text-indigo-600 hover:text-indigo-700">
          ← 返回站点列表
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">新增站点</h1>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              站点名称 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="例如：我的博客、公司网站"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              输入一个易于识别的站点名称
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              域名 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="domain"
              value={formData.domain}
              onChange={handleChange}
              placeholder="例如：example.com 或 www.example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              输入站点的主域名
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分类
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="例如：博客、电商、企业官网"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              可选：输入站点分类用于整理
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              状态
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="online">在线</option>
              <option value="maintenance">维护中</option>
              <option value="offline">离线</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              选择站点的当前状态
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 创建站点后的步骤</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>创建站点并获得唯一的 Site UUID</li>
              <li>转到设置页面配置 Google Analytics</li>
              <li>粘贴你的 Google Cloud Service Account 凭证</li>
              <li>自动发现 GA4 属性并同步数据</li>
            </ol>
          </div>

          <div className="flex gap-3 justify-end">
            <Link
              href="/sites"
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '创建中...' : '创建站点'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
