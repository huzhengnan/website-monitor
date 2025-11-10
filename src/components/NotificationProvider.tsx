'use client';

import { message, Modal } from 'antd';
import { ReactNode } from 'react';
import { CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationOptions {
  title?: string;
  duration?: number;
  onOk?: () => void;
  onCancel?: () => void;
}

/**
 * 显示 Toast 通知（自动消失）
 */
export const showToast = (text: string, type: NotificationType = 'info', duration: number = 2) => {
  switch (type) {
    case 'success':
      message.success(text, duration);
      break;
    case 'error':
      message.error(text, duration);
      break;
    case 'warning':
      message.warning(text, duration);
      break;
    case 'info':
      message.info(text, duration);
      break;
  }
};

/**
 * 显示模态对话框（需要用户确认）
 */
export const showModal = (title: string, content: ReactNode | string, options?: NotificationOptions) => {
  Modal.info({
    title,
    content,
    okText: '确定',
    onOk: options?.onOk,
  });
};

/**
 * 显示成功对话框
 */
export const showSuccessModal = (title: string, content: ReactNode | string, options?: NotificationOptions) => {
  Modal.success({
    title,
    content,
    okText: '确定',
    onOk: options?.onOk,
  });
};

/**
 * 显示错误对话框
 */
export const showErrorModal = (title: string, content: ReactNode | string, options?: NotificationOptions) => {
  Modal.error({
    title,
    content,
    okText: '确定',
    onOk: options?.onOk,
  });
};

/**
 * 显示警告对话框
 */
export const showWarningModal = (title: string, content: ReactNode | string, options?: NotificationOptions) => {
  Modal.warning({
    title,
    content,
    okText: '确定',
    onOk: options?.onOk,
  });
};

/**
 * 显示确认对话框（有取消和确定按钮）
 */
export const showConfirmModal = (title: string, content: ReactNode | string, options?: NotificationOptions) => {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '确定',
      cancelText: '取消',
      onOk() {
        options?.onOk?.();
        resolve(true);
      },
      onCancel() {
        options?.onCancel?.();
        resolve(false);
      },
    });
  });
};

/**
 * 显示导入结果详情（专用于导入流程）
 */
export const showImportResultModal = (
  title: string,
  stats: {
    success: number;
    skipped: number;
    failed: number;
    total: number;
    deduplicated?: number;
    failedDomains?: string[];
  },
  options?: NotificationOptions
) => {
  let content = (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between py-1 border-b">
        <span>✅ 成功导入：</span>
        <span className="font-semibold text-green-600">{stats.success}</span>
      </div>
      {stats.skipped > 0 && (
        <div className="flex justify-between py-1 border-b">
          <span>⏭️ 已存在（跳过）：</span>
          <span className="font-semibold text-blue-600">{stats.skipped}</span>
        </div>
      )}
      {stats.deduplicated && stats.deduplicated > 0 && (
        <div className="flex justify-between py-1 border-b">
          <span>🔗 已去重：</span>
          <span className="font-semibold text-purple-600">{stats.deduplicated}</span>
        </div>
      )}
      {stats.failed > 0 && (
        <div className="border-b pb-2">
          <div className="flex justify-between py-1">
            <span>❌ 失败：</span>
            <span className="font-semibold text-red-600">{stats.failed}</span>
          </div>
          {stats.failedDomains && stats.failedDomains.length > 0 && (
            <div className="mt-2 pl-4 text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
              <div className="font-semibold mb-1">失败的域名：</div>
              {stats.failedDomains.slice(0, 5).map((domain, idx) => (
                <div key={idx}>• {domain}</div>
              ))}
              {stats.failedDomains.length > 5 && (
                <div className="text-gray-500">• 等 {stats.failedDomains.length - 5} 个...</div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex justify-between py-1 bg-gray-50 px-2 rounded">
        <span className="font-semibold">总计：</span>
        <span className="font-semibold">{stats.total} 条</span>
      </div>
    </div>
  );

  if (stats.failed > 0) {
    return showErrorModal(title, content, options);
  } else if (stats.skipped > 0 && stats.success > 0) {
    return showWarningModal(title, content, options);
  } else {
    return showSuccessModal(title, content, options);
  }
};
