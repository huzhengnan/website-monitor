'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getSiteEvaluations,
  getSiteEvaluationStats,
  createEvaluation,
  deleteEvaluation,
  type Evaluation,
  type EvaluationStats,
  type CreateEvaluationRequest,
} from '@/api/evaluations';

export default function EvaluationsPage() {
  const params = useParams();
  const siteId = params.id as string;

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    marketScore: 50,
    qualityScore: 50,
    seoScore: 50,
    trafficScore: 50,
    revenueScore: 50,
    evaluator: '',
    notes: '',
  });

  // Load evaluations and stats
  useEffect(() => {
    if (!siteId) return;
    loadData();
  }, [siteId]);

  const loadData = async () => {
    if (!siteId) return;

    try {
      setLoading(true);
      setError(null);
      const [evaluationsData, statsData] = await Promise.all([
        getSiteEvaluations(siteId),
        getSiteEvaluationStats(siteId),
      ]);
      setEvaluations(evaluationsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) return;

    try {
      setError(null);
      const request: CreateEvaluationRequest = {
        siteId,
        ...formData,
        evaluator: formData.evaluator || undefined,
        notes: formData.notes || undefined,
      };
      await createEvaluation(request);

      // Reset form
      setFormData({
        marketScore: 50,
        qualityScore: 50,
        seoScore: 50,
        trafficScore: 50,
        revenueScore: 50,
        evaluator: '',
        notes: '',
      });
      setShowForm(false);

      // Reload data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create evaluation');
    }
  };

  const handleDelete = async (evaluationId: string) => {
    if (!window.confirm('Are you sure you want to delete this evaluation?')) {
      return;
    }

    try {
      setError(null);
      await deleteEvaluation(evaluationId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete evaluation');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-blue-100';
    if (score >= 40) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '↑';
    if (trend < 0) return '↓';
    return '→';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading evaluations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Site Evaluations</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'New Evaluation'}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Total Evaluations</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalCount}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Latest Composite</div>
            <div className={`text-2xl font-bold ${getScoreColor(stats.latestComposite)}`}>
              {stats.latestComposite}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Avg Composite</div>
            <div className="text-2xl font-bold text-gray-900">{stats.avgComposite.toFixed(1)}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Trend</div>
            <div className={`text-2xl font-bold ${getTrendColor(stats.trend)}`}>
              {getTrendIcon(stats.trend)} {Math.abs(stats.trend)}
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Evaluation</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Market Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.marketScore}
                  onChange={(e) =>
                    setFormData({ ...formData, marketScore: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quality Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.qualityScore}
                  onChange={(e) =>
                    setFormData({ ...formData, qualityScore: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SEO Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.seoScore}
                  onChange={(e) =>
                    setFormData({ ...formData, seoScore: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Traffic Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.trafficScore}
                  onChange={(e) =>
                    setFormData({ ...formData, trafficScore: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Revenue Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.revenueScore}
                  onChange={(e) =>
                    setFormData({ ...formData, revenueScore: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evaluator (Optional)
                </label>
                <input
                  type="text"
                  value={formData.evaluator}
                  onChange={(e) => setFormData({ ...formData, evaluator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Evaluation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Evaluations List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Evaluation History</h2>

          {evaluations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No evaluations yet. Create your first evaluation above.
            </div>
          ) : (
            <div className="space-y-4">
              {evaluations.map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm text-gray-600">
                        {new Date(evaluation.date).toLocaleDateString()}
                      </div>
                      {evaluation.evaluator && (
                        <div className="text-xs text-gray-500">by {evaluation.evaluator}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-2xl font-bold ${getScoreColor(evaluation.compositeScore)}`}
                      >
                        {evaluation.compositeScore}
                      </div>
                      <button
                        onClick={() => handleDelete(evaluation.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: 'Market', score: evaluation.marketScore },
                      { label: 'Quality', score: evaluation.qualityScore },
                      { label: 'SEO', score: evaluation.seoScore },
                      { label: 'Traffic', score: evaluation.trafficScore },
                      { label: 'Revenue', score: evaluation.revenueScore },
                    ].map(({ label, score }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="w-20 text-sm text-gray-600">{label}</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                          <div
                            className={`h-full ${getScoreBgColor(score)} flex items-center justify-end pr-2`}
                            style={{ width: `${score}%` }}
                          >
                            <span className={`text-xs font-semibold ${getScoreColor(score)}`}>
                              {score}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {evaluation.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-600 mb-1">Notes:</div>
                      <div className="text-sm text-gray-700">{evaluation.notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
