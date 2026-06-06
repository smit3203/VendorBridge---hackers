import { useState, useEffect } from 'react';
import api from '../services/api';
import { Activity, FileText, Users, ShoppingCart, ShieldCheck, Receipt } from 'lucide-react';

const entityIcons = {
  rfq: FileText, vendor: Users, quotation: Receipt,
  purchase_order: ShoppingCart, invoice: Receipt,
  approval: ShieldCheck, user: Activity
};

const actionColors = {
  created: 'text-green-400 bg-green-500/10',
  updated: 'text-blue-400 bg-blue-500/10',
  deleted: 'text-red-400 bg-red-500/10',
  submitted: 'text-yellow-400 bg-yellow-500/10',
  approved: 'text-green-400 bg-green-500/10',
  rejected: 'text-red-400 bg-red-500/10',
  sent: 'text-blue-400 bg-blue-500/10',
  login: 'text-navy-400 bg-navy-700',
  registered: 'text-gold-400 bg-gold-400/10'
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = () => {
    setLoading(true);
    api.get('/activity-logs', { params: { entity_type: filterEntity, page, limit: 50 } })
      .then(res => { setLogs(res.data.logs); setTotal(res.data.total); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [filterEntity, page]);

  const getActionColor = (action) => {
    for (const [key, color] of Object.entries(actionColors)) {
      if (action.includes(key)) return color;
    }
    return 'text-navy-400 bg-navy-700';
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Activity Logs</h1>
          <p className="text-navy-400 mt-1">{total} log entries</p>
        </div>
        <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm focus:outline-none">
          <option value="">All Activities</option>
          <option value="rfq">RFQs</option>
          <option value="vendor">Vendors</option>
          <option value="quotation">Quotations</option>
          <option value="purchase_order">Purchase Orders</option>
          <option value="invoice">Invoices</option>
          <option value="approval">Approvals</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-navy-500">No activity logs found</div>
      ) : (
        <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl divide-y divide-navy-800/50">
          {logs.map((log, idx) => {
            const Icon = entityIcons[log.entity_type] || Activity;
            const colorClass = getActionColor(log.action);

            return (
              <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-navy-800/20 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 0.03}s` }}>
                <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{log.user_name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colorClass}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-navy-400 mt-0.5">{log.details}</p>
                  <p className="text-xs text-navy-600 mt-1">{formatDate(log.created_at)}</p>
                </div>
                {log.entity_type && (
                  <span className="text-xs text-navy-600 capitalize flex-shrink-0">
                    {log.entity_type.replace('_', ' ')} #{log.entity_id}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 bg-navy-800 border border-navy-700 rounded-lg text-sm text-navy-400 hover:text-white disabled:opacity-50">
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-navy-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}
            className="px-3 py-1.5 bg-navy-800 border border-navy-700 rounded-lg text-sm text-navy-400 hover:text-white disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
