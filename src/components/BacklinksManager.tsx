'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, ExternalLink, Upload } from 'lucide-react';
import { showToast, showImportResultModal, showErrorModal, showSuccessModal } from './NotificationProvider';
import { deduplicateUrls, normalizeUrl, extractDomain } from '@/lib/services/url-normalization.service';

interface BacklinkSite {
  id: string;
  url: string;
  domain: string;
  dr?: number;
  note?: string;
}

interface BacklinkSubmission {
  id: string;
  siteId: string;
  backlinkSiteId: string;
  status: string;
  notes?: string;
  submitDate?: string;
  indexedDate?: string;
  cost?: number;
  backlinkSite: BacklinkSite;
}

const statusOptions = [
  { value: 'pending', label: '待处理', color: 'bg-gray-100 text-gray-800' },
  { value: 'submitted', label: '已提交', color: 'bg-blue-100 text-blue-800' },
  { value: 'indexed', label: '已收录', color: 'bg-green-100 text-green-800' },
  { value: 'contacted', label: '已联系', color: 'bg-purple-100 text-purple-800' },
  { value: 'failed', label: '失败', color: 'bg-red-100 text-red-800' },
];

interface BacklinksManagerProps {
  siteId: string;
}

export function BacklinksManager({ siteId }: BacklinksManagerProps) {
  const [submissions, setSubmissions] = useState<BacklinkSubmission[]>([]);
  const [backlinkSites, setBacklinkSites] = useState<BacklinkSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pasteData, setPasteData] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<'submitted' | 'indexed'>('submitted'); // 导入时的默认状态
  const [formData, setFormData] = useState({
    backlinkSiteId: '',
    status: 'pending',
    notes: '',
    submitDate: '',
    indexedDate: '',
    cost: '',
  });

  useEffect(() => {
    loadSubmissions();
  }, [siteId]);

  useEffect(() => {
    loadBacklinkSites();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/backlinks?siteId=${siteId}`);
      if (response.ok) {
        const result = await response.json();
        setSubmissions(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBacklinkSites = async () => {
    try {
      const response = await fetch('/api/backlink-sites?pageSize=500');
      if (response.ok) {
        const result = await response.json();
        setBacklinkSites(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load backlink sites:', error);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteData.trim()) {
      showErrorModal('⚠️ 请粘贴数据', (
        <div className="space-y-2">
          <p>请先粘贴数据再导入</p>
          <div className="mt-3 text-sm">
            <p className="font-semibold mb-2">支持的格式：</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>纯域名列表</li>
              <li>GSC 导出数据</li>
              <li>任何包含域名的格式</li>
            </ul>
          </div>
        </div>
      ));
      return;
    }

    const lines = pasteData.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      showErrorModal('⚠️ 数据为空', '请检查您粘贴的内容是否正确');
      return;
    }

    try {
      setImportLoading(true);

      // 先重新加载所有现有的外链库（确保列表完整）
      let currentBacklinkSites: BacklinkSite[] = [];
      try {
        const listResponse = await fetch('/api/backlink-sites?pageSize=1000&page=1');
        if (listResponse.ok) {
          const result = await listResponse.json();
          currentBacklinkSites = result.data || [];
          console.log(`✓ Loaded ${currentBacklinkSites.length} backlink sites from database`);
        }
      } catch (error) {
        console.error('Failed to load backlink sites:', error);
        currentBacklinkSites = backlinkSites; // Fallback to cached list
      }

      // 先一次性获取所有现有的提交记录
      let existingSubmissions: BacklinkSubmission[] = [];
      try {
        const checkResponse = await fetch(`/api/backlinks?siteId=${siteId}`);
        if (checkResponse.ok) {
          const result = await checkResponse.json();
          existingSubmissions = result.data || [];
        }
      } catch (error) {
        console.error('Failed to load existing submissions:', error);
      }

      // 解析粘贴的数据 - 处理多种格式
      const lines = pasteData.trim().split('\n');
      let imported = 0;
      let skipped = 0;
      let failed = 0;
      let deduplicated = 0; // 记录去重数量
      const failedDomains: string[] = []; // 记录失败的域名

      // 收集所有可能的 URL（用于规范化和去重）
      const urlsToImport: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;

        // 跳过表头
        if (trimmed.toLowerCase() === '网站' ||
            trimmed.toLowerCase() === '引荐网页数' ||
            trimmed.toLowerCase() === '着陆页') {
          continue;
        }

        // 检查是否是纯数字行（表格中的数据行，应该跳过）
        if (/^\d+(\s+\d+)*$/.test(trimmed)) {
          continue;
        }

        // 尝试提取 URL/域名
        // 支持的格式：
        // 1. 纯域名: example.com
        // 2. URL: https://example.com
        // 3. 域名+数字混合: toptool.app (数字会被忽略)
        // 4. 多个域名在一行: example.com example2.com

        const parts = trimmed.split(/\s+/);
        for (const part of parts) {
          // 检查是否看起来像域名或 URL（包含 . 且不是纯数字）
          if (part.includes('.') && !/^\d+$/.test(part) && !part.match(/^\d+\.\d+$/) && !/^https?:\/\/\d+/.test(part)) {
            // 移除前后的特殊字符（如果有的话）
            const cleaned = part.replace(/^[^\w]|[^\w]$/g, '');
            if (cleaned && cleaned.includes('.')) {
              urlsToImport.push(cleaned);
            }
          }
        }
      }

      // 对收集到的 URL 进行规范化和去重
      const originalCount = urlsToImport.length;
      const deduplicatedUrls = deduplicateUrls(urlsToImport);
      deduplicated = originalCount - deduplicatedUrls.length;

      // 创建 URL 到域名的映射
      const urlToDomainMap = new Map<string, string>();
      deduplicatedUrls.forEach(url => {
        const domain = extractDomain(url).toLowerCase();
        urlToDomainMap.set(domain, url);
      });

      // 现在导入收集到的域名
      for (const [domain, normalizedUrl] of urlToDomainMap.entries()) {

        // 在现有的外链站点中查找（使用新加载的完整列表）
        const existingSite = currentBacklinkSites.find(s =>
          s.domain?.toLowerCase() === domain.toLowerCase() ||
          s.url?.toLowerCase().includes(domain.toLowerCase())
        );

        if (existingSite) {
          // 检查是否已存在这个提交记录（使用已加载的数据）
          const alreadyExists = existingSubmissions.some(
            (sub: BacklinkSubmission) => sub.backlinkSiteId === existingSite.id
          );

          if (!alreadyExists) {
            try {
              // 创建新的提交记录
              const response = await fetch('/api/backlinks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  siteId,
                  backlinkSiteId: existingSite.id,
                  status: importStatus,
                  notes: '',
                  submitDate: new Date().toISOString().split('T')[0],
                  indexedDate: importStatus === 'indexed' ? new Date().toISOString().split('T')[0] : null,
                  cost: null,
                }),
              });

              if (response.ok) {
                imported++;
                // 同时更新本地的 existingSubmissions，防止后续重复导入
                const newSubmission = await response.json();
                if (newSubmission.data) {
                  existingSubmissions.push({
                    ...newSubmission.data,
                    backlinkSiteId: existingSite.id,
                  } as BacklinkSubmission);
                }
              } else if (response.status === 409) {
                // 409 Conflict：提交记录已存在，作为已跳过处理
                console.info(`Submission already exists for ${domain}`);
                skipped++;
              } else {
                console.error(`Failed to create submission for ${domain}:`, response.statusText);
                failed++;
              }
            } catch (error) {
              console.error(`Failed to import ${domain}:`, error);
              failed++;
            }
          } else {
            skipped++;
          }
        } else {
          // 域名在库中找不到，尝试先添加到外链库
          console.warn(`Domain not found in backlink sites: ${domain}`);
          failedDomains.push(normalizedUrl); // 记录需要添加的 URL
        }
      }

      // 显示导入结果弹窗
      showImportResultModal('导入完成', {
        success: imported,
        skipped: skipped,
        failed: failed,
        total: imported + skipped + failed,
        deduplicated: deduplicated,
        failedDomains: failed > 0 ? failedDomains : undefined,
      });

      // 如果有失败的域名，自动添加到外链库或获取已存在的记录
      if (failedDomains.length > 0) {
        try {
          let autoAddedCount = 0;
          let createdCount = 0;
          const newSubmissionsForAdded: any[] = [];

          for (const normalizedUrl of failedDomains) {
            try {
              const domain = extractDomain(normalizedUrl).toLowerCase();
              const addResponse = await fetch('/api/backlink-sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: normalizedUrl,
                  domain: domain,
                }),
              });

              if (addResponse.ok) {
                const result = await addResponse.json();
                const backlinkSiteId = result.data?.id;

                if (backlinkSiteId) {
                  // 成功创建或获取到外链站点，现在为当前网站创建提交记录
                  try {
                    const submissionResponse = await fetch('/api/backlinks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        siteId,
                        backlinkSiteId,
                        status: importStatus,
                        notes: '',
                        submitDate: new Date().toISOString().split('T')[0],
                        indexedDate: importStatus === 'indexed' ? new Date().toISOString().split('T')[0] : null,
                        cost: null,
                      }),
                    });

                    if (submissionResponse.ok) {
                      autoAddedCount++;
                      createdCount++;
                      const submissionData = await submissionResponse.json();
                      if (submissionData.data) {
                        newSubmissionsForAdded.push(submissionData.data);
                      }
                      console.log(`✅ Domain added and submission created: ${domain}`);
                    } else {
                      // 站点创建成功但提交记录创建失败
                      autoAddedCount++;
                      console.warn(`Site added but submission creation failed: ${domain}`);
                    }
                  } catch (submissionError) {
                    // 站点创建成功但提交记录创建异常
                    autoAddedCount++;
                    console.warn(`Site added but submission creation error: ${domain}`, submissionError);
                  }
                }

                if (result.status === 'duplicate_merged') {
                  console.log(`✅ Merged with existing domain: ${domain}`);
                } else if (result.status === 'duplicate_exists') {
                  console.log(`ℹ️ Domain already exists: ${domain}`);
                }
              } else if (addResponse.status === 409) {
                // 409 表示 URL 完全相同已存在，需要查询该记录并创建提交
                try {
                  // 重新加载外链站点列表并查找这个域名
                  const listResponse = await fetch(`/api/backlink-sites?pageSize=500`);
                  if (listResponse.ok) {
                    const listResult = await listResponse.json();
                    const existingSite = listResult.data?.find((s: any) =>
                      s.url?.toLowerCase() === normalizedUrl.toLowerCase() ||
                      s.domain?.toLowerCase() === domain.toLowerCase()
                    );

                    if (existingSite) {
                      // 为这个站点创建提交记录
                      const submissionResponse = await fetch('/api/backlinks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          siteId,
                          backlinkSiteId: existingSite.id,
                          status: importStatus,
                          notes: '',
                          submitDate: new Date().toISOString().split('T')[0],
                          indexedDate: importStatus === 'indexed' ? new Date().toISOString().split('T')[0] : null,
                          cost: null,
                        }),
                      });

                      if (submissionResponse.ok) {
                        autoAddedCount++;
                        createdCount++;
                        console.log(`✅ Submission created for existing site: ${domain}`);
                      } else if (submissionResponse.status === 409) {
                        // 提交记录也已存在，计为跳过
                        console.info(`Submission already exists for ${domain}`);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`Error handling existing site: ${domain}`, error);
                }
              } else {
                const error = await addResponse.json();
                console.warn(`Failed to add domain to backlink sites: ${domain}`, error);
              }
            } catch (error) {
              console.error(`Error processing domain to backlink sites:`, error);
            }
          }

          // 重新加载外链库列表和提交列表
          if (autoAddedCount > 0) {
            await loadBacklinkSites();
            await loadSubmissions();
          }
        } catch (error) {
          console.error('Error processing failed domains:', error);
        }
      }

      loadSubmissions();
      setShowPasteImport(false);
      setPasteData('');
    } catch (error) {
      console.error('Failed to process paste import:', error);
      showErrorModal('导入异常', (
        <div className="space-y-3">
          <p className="text-red-600 font-semibold">❌ 处理数据时出错</p>
          <div className="text-sm space-y-2">
            <p className="font-semibold">请检查：</p>
            <ul className="list-decimal list-inside space-y-1 text-gray-700">
              <li>网络连接是否正常</li>
              <li>数据格式是否正确</li>
              <li>查看浏览器控制台了解详情 (F12)</li>
            </ul>
          </div>
          <p className="text-gray-600 text-sm mt-3">请重试或联系技术支持</p>
        </div>
      ));
    } finally {
      setImportLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.backlinkSiteId) {
      showToast('请选择外链站点', 'warning');
      return;
    }

    try {
      const payload = {
        siteId,
        backlinkSiteId: formData.backlinkSiteId,
        status: formData.status,
        notes: formData.notes || null,
        submitDate: formData.submitDate || null,
        indexedDate: formData.indexedDate || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
      };

      const response = await fetch('/api/backlinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showToast('添加成功', 'success');
        loadSubmissions();
        setShowAddForm(false);
        resetForm();
      } else {
        const error = await response.json();
        showToast(error.message || '添加失败', 'error');
      }
    } catch (error) {
      console.error('Failed to add submission:', error);
      showToast('添加失败', 'error');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const payload = {
        status: formData.status,
        notes: formData.notes || null,
        submitDate: formData.submitDate || null,
        indexedDate: formData.indexedDate || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
      };

      const response = await fetch(`/api/backlinks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showToast('更新成功', 'success');
        loadSubmissions();
        setEditingId(null);
        resetForm();
      } else {
        showToast('更新失败', 'error');
      }
    } catch (error) {
      console.error('Failed to update submission:', error);
      showToast('更新失败', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      const modal = require('antd').Modal.confirm({
        title: '确认删除',
        content: '确定要删除此记录吗？此操作无法撤销。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk() {
          resolve(true);
        },
        onCancel() {
          resolve(false);
        },
      });
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/backlinks/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showToast('删除成功', 'success');
        loadSubmissions();
      } else {
        showToast('删除失败', 'error');
      }
    } catch (error) {
      console.error('Failed to delete submission:', error);
      showToast('删除失败', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      backlinkSiteId: '',
      status: 'pending',
      notes: '',
      submitDate: '',
      indexedDate: '',
      cost: '',
    });
  };

  const handleEditClick = (submission: BacklinkSubmission) => {
    setEditingId(submission.id);
    setFormData({
      backlinkSiteId: submission.backlinkSiteId,
      status: submission.status,
      notes: submission.notes || '',
      submitDate: submission.submitDate ? submission.submitDate.split('T')[0] : '',
      indexedDate: submission.indexedDate ? submission.indexedDate.split('T')[0] : '',
      cost: submission.cost?.toString() || '',
    });
  };

  const getStatusColor = (status: string): string => {
    const option = statusOptions.find(s => s.value === status);
    return option?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string): string => {
    const option = statusOptions.find(s => s.value === status);
    return option?.label || status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">外链管理</h3>
          <p className="text-sm text-muted-foreground mt-1">
            管理外链提交记录和状态追踪
          </p>
        </div>
        {!showAddForm && !editingId && !showPasteImport && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPasteImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
            >
              <Upload className="w-4 h-4" />
              快速导入
            </button>
            <button
              onClick={() => {
                setShowAddForm(true);
                resetForm();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Plus className="w-4 h-4" />
              添加外链
            </button>
          </div>
        )}
      </div>

      {/* Paste Import Form */}
      {showPasteImport && (
        <div className="bg-card border border-amber-200 dark:border-amber-900/40 rounded-lg p-6 space-y-4">
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">快速导入外链提交</h4>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded p-3">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                ℹ️ 支持任何包含域名的格式，例如：纯域名、URL、表格数据、GSC 导出数据等。
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">数据格式示例：</p>
            <div className="bg-muted/30 rounded p-4 text-xs text-muted-foreground font-mono space-y-2">
              <div className="space-y-1">
                <div className="font-semibold text-foreground">格式1：纯域名</div>
                <div>example.com</div>
                <div>test.com</div>
              </div>
              <div className="my-2 border-t border-muted/50"></div>
              <div className="space-y-1">
                <div className="font-semibold text-foreground">格式2：表格（GSC 导出）</div>
                <div>网站&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;引荐网页数&nbsp;&nbsp;&nbsp;&nbsp;着陆页</div>
                <div>example.com&nbsp;&nbsp;&nbsp;3&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>test.com&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2</div>
              </div>
            </div>
          </div>

          <textarea
            value={pasteData}
            onChange={e => setPasteData(e.target.value)}
            placeholder="粘贴您的数据（每行一个站点）..."
            rows={8}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
          />

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">导入后的初始状态：</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="import-status"
                  value="submitted"
                  checked={importStatus === 'submitted'}
                  onChange={e => setImportStatus(e.target.value as 'submitted' | 'indexed')}
                  className="w-4 h-4"
                />
                <span className="text-sm">已提交 (submitted)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="import-status"
                  value="indexed"
                  checked={importStatus === 'indexed'}
                  onChange={e => setImportStatus(e.target.value as 'submitted' | 'indexed')}
                  className="w-4 h-4"
                />
                <span className="text-sm">已收录 (indexed)</span>
              </label>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded p-3">
            <p className="text-xs text-amber-900 dark:text-amber-300">
              ⚠️ 系统会自动跳过已导入过的域名，防止重复。失败的域名可能不在外链库中。
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handlePasteImport}
              disabled={importLoading || !pasteData.trim()}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {importLoading ? '导入中...' : '开始导入'}
            </button>
            <button
              onClick={() => {
                setShowPasteImport(false);
                setPasteData('');
              }}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h4 className="font-semibold text-foreground">
            {editingId ? '编辑提交记录' : '添加新的外链提交'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  外链站点 *
                </label>
                <select
                  value={formData.backlinkSiteId}
                  onChange={e =>
                    setFormData({ ...formData, backlinkSiteId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">选择站点...</option>
                  {backlinkSites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.domain} (DR:{site.dr || '-'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                状态
              </label>
              <select
                value={formData.status}
                onChange={e =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                提交日期
              </label>
              <input
                type="date"
                value={formData.submitDate}
                onChange={e =>
                  setFormData({ ...formData, submitDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                收录日期
              </label>
              <input
                type="date"
                value={formData.indexedDate}
                onChange={e =>
                  setFormData({ ...formData, indexedDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                费用 ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                备注
              </label>
              <textarea
                value={formData.notes}
                onChange={e =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="添加任何相关的备注..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                if (editingId) {
                  handleUpdate(editingId);
                } else {
                  handleAdd();
                }
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              {editingId ? '更新' : '添加'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingId(null);
                resetForm();
              }}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Submissions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无外链提交记录
          </div>
        ) : (
          submissions.map(submission => (
            <div
              key={submission.id}
              className="bg-card border border-border rounded-lg p-4 hover:border-indigo-300 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <a
                        href={submission.backlinkSite.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium flex items-center gap-2 truncate"
                      >
                        {submission.backlinkSite.domain}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                      {submission.backlinkSite.dr && (
                        <p className="text-xs text-muted-foreground mt-1">
                          DR: {submission.backlinkSite.dr}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(
                        submission.status
                      )}`}
                    >
                      {getStatusLabel(submission.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {submission.submitDate && (
                      <div>
                        <div className="text-xs text-muted-foreground">提交日期</div>
                        <div className="text-foreground">
                          {new Date(submission.submitDate).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    )}
                    {submission.indexedDate && (
                      <div>
                        <div className="text-xs text-muted-foreground">收录日期</div>
                        <div className="text-foreground">
                          {new Date(submission.indexedDate).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    )}
                    {submission.cost && (
                      <div>
                        <div className="text-xs text-muted-foreground">费用</div>
                        <div className="text-foreground">${submission.cost.toFixed(2)}</div>
                      </div>
                    )}
                  </div>

                  {submission.notes && (
                    <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded px-2 py-1">
                      {submission.notes}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEditClick(submission)}
                    className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(submission.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-muted-foreground hover:text-red-600"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {submissions.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">总数</div>
            <div className="text-2xl font-bold text-foreground">{submissions.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">已收录</div>
            <div className="text-2xl font-bold text-green-600">
              {submissions.filter(s => s.status === 'indexed').length}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">已提交</div>
            <div className="text-2xl font-bold text-blue-600">
              {submissions.filter(s => s.status === 'submitted').length}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">总费用</div>
            <div className="text-2xl font-bold text-foreground">
              ${submissions.reduce((sum, s) => sum + (s.cost || 0), 0).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">收录率</div>
            <div className="text-2xl font-bold text-purple-600">
              {submissions.length > 0
                ? ((submissions.filter(s => s.status === 'indexed').length /
                    submissions.length) *
                  100)
                    .toFixed(1)
                    .concat('%')
                : '0%'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
