'use client';

import { useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import { listBacklinks } from '@/api/backlinks';

export default function BacklinksFooter() {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDomains = async () => {
      try {
        // Fetch all backlinks with large page size
        const res = await listBacklinks({ pageSize: 1000 });
        if (res.success && res.data) {
          const sortedDomains = res.data
            .map(site => site.domain)
            .filter(domain => !!domain)
            .sort();
          setDomains(sortedDomains);
        }
      } catch (error) {
        console.error('Failed to load backlinks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDomains();
  }, []);

  if (loading) {
    return (
      <div className="w-full py-8 flex justify-center">
        <Spin />
      </div>
    );
  }

  if (domains.length === 0) {
    return <Empty description="暂无外链" />;
  }

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            友情链接
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            我们的合作伙伴和友情链接列表（共 {domains.length} 个）
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {domains.map((domain) => (
            <a
              key={domain}
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              title={domain}
              className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 whitespace-nowrap overflow-hidden overflow-ellipsis"
            >
              {domain}
            </a>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <p>
            这些链接来自我们精心收集的高质量网站目录和导航，旨在为您提供有用的资源和参考。
          </p>
        </div>
      </div>
    </footer>
  );
}
