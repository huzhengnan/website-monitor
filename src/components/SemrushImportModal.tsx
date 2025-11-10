'use client';

import { useState } from 'react';
import { Modal, Button, Input, message, Table, Tag, Space, Divider, Alert } from 'antd';
import { importSemrushData } from '@/api/backlinks';
import { showSuccessModal, showErrorModal } from './NotificationProvider';

interface SemrushImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SemrushImportModal({
  visible,
  onClose,
  onSuccess,
}: SemrushImportModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleImport = async () => {
    if (!pastedText.trim()) {
      message.error('请粘贴 Semrush 数据');
      return;
    }

    // 如果没有检测到域名，需要用户输入
    if (!pastedText.includes('.com') && !pastedText.includes('.io') && !domainInput.trim()) {
      message.error('请输入域名或在 Semrush 数据中包含域名');
      return;
    }

    setLoading(true);
    try {
      let textToImport = pastedText;
      // 如果用户输入了域名，添加到数据开头
      if (domainInput.trim() && !pastedText.includes(domainInput)) {
        textToImport = `${domainInput}\n${pastedText}`;
      }
      const response = await importSemrushData(textToImport);

      if (response.success && response.data) {
        setResults(response.data);
        showSuccessModal('✅ Semrush 数据导入成功', (
          <div className="space-y-3">
            <div className="flex justify-between py-1">
              <span>总计：</span>
              <span className="font-semibold">{response.data.total} 个域名</span>
            </div>
            <div className="flex justify-between py-1 text-green-600">
              <span>✅ 新建：</span>
              <span className="font-semibold">{response.data.created} 个</span>
            </div>
            {response.data.updated > 0 && (
              <div className="flex justify-between py-1 text-blue-600">
                <span>🔄 更新：</span>
                <span className="font-semibold">{response.data.updated} 个</span>
              </div>
            )}
            {response.data.failed > 0 && (
              <div className="flex justify-between py-1 text-red-600">
                <span>❌ 失败：</span>
                <span className="font-semibold">{response.data.failed} 个</span>
              </div>
            )}
          </div>
        ));

        // 显示错误详情
        if (response.data?.errors && response.data.errors.length > 0) {
          setTimeout(() => {
            showErrorModal('⚠️ 导入错误详情', (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {response.data?.errors?.map((err: any, idx: number) => (
                  <div key={idx} className="text-sm p-2 bg-gray-50 rounded">
                    <div className="font-semibold">{err.domain}</div>
                    <div className="text-red-600 text-xs">{err.error}</div>
                  </div>
                ))}
              </div>
            ));
          }, 500);
        }

        // 清空表单
        setPastedText('');
        setDomainInput('');
        onSuccess?.();

        // 2 秒后关闭
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        message.error(response.message || '导入失败');
      }
    } catch (error: any) {
      message.error(error.message || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="导入 Semrush 数据"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={loading}
          onClick={handleImport}
        >
          导入数据
        </Button>,
      ]}
    >
      <div className="space-y-4">
        {/* 使用说明 */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
          <div className="font-semibold text-blue-900 mb-2">📋 使用说明：</div>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>在 Semrush 中查看域名的 Overview 页面</li>
            <li>选中 Authority Score、Organic traffic、Backlinks 等数据</li>
            <li>复制粘贴到下面的文本框中</li>
            <li>点击"导入数据"按钮</li>
          </ol>
        </div>

        <Divider />

        {/* 域名输入框 */}
        <div>
          <label className="block text-sm font-medium mb-2">域名 <span className="text-gray-400">（可选，如果粘贴的数据已包含域名则不需要）</span>：</label>
          <Input
            placeholder="例如：producthunt.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* 数据输入框 */}
        <div>
          <label className="block text-sm font-medium mb-2">粘贴 Semrush 数据：</label>
          <Input.TextArea
            placeholder={`示例：
Authority Score
49
Organic traffic
256.5K
Ref.Domains
180K
Backlinks
69.5M

或者包含域名：
producthunt.com
Authority Score
49
...`}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={10}
            disabled={loading}
          />
          {!pastedText.includes('.com') && !pastedText.includes('.io') && !domainInput.trim() && (
            <Alert
              message="提示：请输入域名或在粘贴的数据中包含域名"
              type="warning"
              showIcon
              style={{ marginTop: '8px' }}
            />
          )}
        </div>

        {/* 支持的字段 */}
        <div className="text-xs text-gray-500">
          <details>
            <summary className="cursor-pointer font-medium">📊 支持的数据字段（点击展开）</summary>
            <div className="mt-2 space-y-1 ml-4">
              <div>✓ Authority Score（权威分数）</div>
              <div>✓ Organic traffic（有机流量）</div>
              <div>✓ Organic keywords（有机关键词）</div>
              <div>✓ Paid traffic（付费流量）</div>
              <div>✓ Backlinks（外链数）</div>
              <div>✓ Ref.Domains（引用域名）</div>
              <div>✓ AI Visibility（AI 能见度）</div>
              <div>✓ AI Mentions（AI 提及）</div>
              <div>✓ 流量变化百分比（如 +1.7%）</div>
              <div>✓ 关键词变化百分比（如 -5.7%）</div>
            </div>
          </details>
        </div>
      </div>
    </Modal>
  );
}
