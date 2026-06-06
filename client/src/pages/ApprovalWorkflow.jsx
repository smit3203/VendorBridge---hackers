import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ApprovalWorkflow() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchApprovals = () => {
    setLoading(true);
    api.get('/approvals', { params: { action: filterAction } })
      .then(res => { setApprovals(res.data.approvals); setTotal(res.data.total); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchApprovals(); }, [filterAction]);

  const handleAction = async (action) => {
    if (!selected) return;
    setProcessing(true);
    try {
      await api.put(`/approvals/${selected.id}`, { action, remarks });
      setShowModal(false);
      setRemarks('');
      fetchApprovals();
    } catch (err) { alert(err.response?.data?.error || 'Action failed'); }
    finally { setProcessing(false); }
  };

  const actionColors = {
    pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    approved: 'bg-green-500/10 text-green-400 border border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border border-red-500/20'
  };

  const canProcess = (approval) => {
    if (approval.action !== 'pending') return false;
    if (user.role === 'admin') return true;
    if (user.role === 'manager' && approval.approver_id === user.id) return true;
    return false;
  };

  const columns = [
    { header: 'RFQ', render: (r) => (
      <div>
        <p className="font-mono text-gold-400 text-xs">{r.rfq_number}</p>
        <p className="text-white font-medium text-sm">{r.rfq_title}</p>
      </div>
    )},
    { header: 'Vendor', render: (r) => r.vendor_name || '-' },
    { header: 'Amount', render: (r) => r.total_amount ? `₹${Number(r.total_amount).toLocaleString('en-IN')}` : '-' },
    { header: 'Approver', accessor: 'approver_name' },
    { header: 'Status', render: (r) => (
      <div className="flex items-center gap-2">
        {r.action === 'approved' && <CheckCircle className="w-4 h-4 text-green-400" />}
        {r.action === 'rejected' && <XCircle className="w-4 h-4 text-red-400" />}
        {r.action === 'pending' && <Clock className="w-4 h-4 text-yellow-400" />}
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${actionColors[r.action]}`}>{r.action}</span>
      </div>
    )},
    { header: 'Remarks', render: (r) => <span className="text-navy-400 text-xs">{r.remarks || '-'}</span> },
    { header: 'Actions', render: (r) => canProcess(r) ? (
      <div className="flex gap-2">
        <button onClick={() => { setSelected(r); setShowModal(true); }}
          className="px-3 py-1.5 bg-gold-400/10 text-gold-400 rounded-lg text-xs font-medium hover:bg-gold-400/20 transition-colors">
          Review
        </button>
      </div>
    ) : null }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Approval Workflow</h1>
        <p className="text-navy-400 mt-1">{total} approval request(s)</p>
      </div>

      <div className="flex gap-3">
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm focus:outline-none">
          <option value="">All Actions</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl overflow-hidden">
        <DataTable columns={columns} data={approvals} loading={loading} emptyMessage="No approval requests" />
      </div>

      {/* Review Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Review Approval">
        {selected && (
          <div className="space-y-4">
            <div className="p-4 bg-navy-800/50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-navy-400 text-sm">RFQ:</span>
                <span className="text-white text-sm font-medium">{selected.rfq_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400 text-sm">Title:</span>
                <span className="text-white text-sm">{selected.rfq_title}</span>
              </div>
              {selected.vendor_name && (
                <div className="flex justify-between">
                  <span className="text-navy-400 text-sm">Vendor:</span>
                  <span className="text-white text-sm">{selected.vendor_name}</span>
                </div>
              )}
              {selected.total_amount && (
                <div className="flex justify-between">
                  <span className="text-navy-400 text-sm">Amount:</span>
                  <span className="text-gold-400 font-semibold">₹{Number(selected.total_amount).toLocaleString('en-IN')}</span>
                </div>
              )}
              {selected.delivery_timeline && (
                <div className="flex justify-between">
                  <span className="text-navy-400 text-sm">Delivery:</span>
                  <span className="text-white text-sm">{selected.delivery_timeline}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Remarks</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Add your remarks..."
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none resize-none" />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-navy-700/50">
              <button onClick={() => handleAction('rejected')} disabled={processing}
                className="flex items-center gap-2 px-5 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/20 disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button onClick={() => handleAction('approved')} disabled={processing}
                className="flex items-center gap-2 px-5 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-sm font-medium hover:bg-green-500/20 disabled:opacity-50">
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
