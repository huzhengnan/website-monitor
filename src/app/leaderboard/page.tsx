'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, type LeaderboardEntry } from '@/api/evaluations';
import RadarChart from '@/components/RadarChart';

type Dimension = 'composite' | 'market' | 'quality' | 'seo' | 'traffic' | 'revenue';

export default function LeaderboardPage() {
  const [dimension, setDimension] = useState<Dimension>('composite');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [dimension, page, pageSize]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getLeaderboard(dimension, { page, pageSize });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const dimensions: { value: Dimension; label: string; description: string }[] = [
    { value: 'composite', label: 'Composite', description: 'Overall score' },
    { value: 'market', label: 'Market', description: 'Market evaluation' },
    { value: 'quality', label: 'Quality', description: 'Quality score' },
    { value: 'seo', label: 'SEO', description: 'SEO performance' },
    { value: 'traffic', label: 'Traffic', description: 'Traffic score' },
    { value: 'revenue', label: 'Revenue', description: 'Revenue score' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading leaderboard...</div>
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
        <p className="text-gray-600 mt-1">Top performing sites ranked by evaluation scores</p>
      </div>

      {/* Dimension Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Dimension</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {dimensions.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => {
                setDimension(value);
                setPage(1);
              }}
              className={`p-3 rounded-lg text-sm font-medium transition-all ${
                dimension === value
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={description}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Top {pageSize} by {dimensions.find((d) => d.value === dimension)?.label}
              </h2>

              {items.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No sites with evaluations found
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((entry) => (
                    <div
                      key={entry.siteId}
                      onClick={() => setSelectedSite(entry)}
                      className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all ${
                        selectedSite?.siteId === entry.siteId
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      {/* Rank */}
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-lg font-bold">
                        {getMedalEmoji(entry.rank)}
                      </div>

                      {/* Site Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{entry.siteName}</div>
                        <div className="text-sm text-gray-600 truncate">{entry.domain}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(entry.evaluationDate).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getScoreColor(entry.score)}`}>
                          {entry.score}
                        </div>
                        <div className="text-xs text-gray-600">
                          {dimensions.find((d) => d.value === dimension)?.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {page} of {totalPages} • Total {total} sites
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Site Details */}
        {selectedSite && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>

              {/* Site Name */}
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Site</div>
                <div className="font-semibold text-gray-900">{selectedSite.siteName}</div>
                <div className="text-sm text-gray-600">{selectedSite.domain}</div>
              </div>

              {/* Rank */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-4xl font-bold mb-1">{getMedalEmoji(selectedSite.rank)}</div>
                <div className="text-sm text-gray-600">Rank #{selectedSite.rank}</div>
              </div>

              {/* All Scores */}
              <div className="space-y-2">
                {[
                  { label: 'Composite', value: selectedSite.scores.composite },
                  { label: 'Market', value: selectedSite.scores.market },
                  { label: 'Quality', value: selectedSite.scores.quality },
                  { label: 'SEO', value: selectedSite.scores.seo },
                  { label: 'Traffic', value: selectedSite.scores.traffic },
                  { label: 'Revenue', value: selectedSite.scores.revenue },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className={`font-semibold ${getScoreColor(value)}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Radar Chart */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-900 mb-3">Score Distribution</div>
                <RadarChart data={selectedSite.scores} height={300} showLegend={false} />
              </div>

              {/* Evaluation Date */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-600">
                  Evaluated: {new Date(selectedSite.evaluationDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
