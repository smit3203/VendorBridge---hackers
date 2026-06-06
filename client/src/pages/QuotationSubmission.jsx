import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Plus, Send, Eye, GitCompare } from 'lucide-react';

export default function QuotationSubmission() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isVendor = user?.role === 'vendor';
  const [quotations, setQuotations] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [form, setForm] = useState({ rfq_id: '', delivery_timeline: '', notes: '', items: [] });
  const [saving, setSaving] = useState(false);

  const fetchQuotations = () => {
    setLoading(true);
    api.get('/quotations')
      .then(res => setQuotations(res.data.quotations))
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuotations();
    // Fetch open RFQs for vendor to quote on
    if (isVendor) {
      api.get('/rfqs', { params: { status: 'open' } })
        .then(res => setRfqs(res.data.rfqs)).catch(console.error);
    }
  }, [isVendor]);

  const handleRFQSelect = async (rfqId) => {
    setForm(f => ({ ...f, rfq_id: rfqId, items: [] }));
    if (rfqId) {
      try {
        const res = await api.get(`/rfqs/${rfqId}`);
        const rfq = res.data.rfq;
        setSelectedRFQ(rfq);
        setForm(f => ({
          ...f,
          items: rfq.items.map(item => ({
            rfq_item_id: item.id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: 0,
            notes: ''
          }))
        }));
      } catch (err) { console.error(err); }
    }
  };

  const updateItemPrice = (i, val) => {
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, unit_price: parseFloat(val) || 0 } : item) }));
  };

  const handleSubmitQuotation = async () => {
    setSaving(true);
    try {
      await api.post('/quotations', form);
      setShowModal(false);
      fetchQuotations();
    } catch (err) { alert(err.response?.data?.error || 'Submit failed'); }
    finally { setSaving(false); }
  };

  const totalEstimate = form.items.reduce((sum, item) => sum + (item.unit_price * (item.quantity || 1)), 0);

  const statusColors = {
    submitted: 'bg-yellow-500/10 text-yellow-400',
    selected: 'bg-green-500/10 text-green-400 border border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-navy-700 text-navy-400'
  };

  const columns = [
    { header: 'Quote #', render: (r) => <span className="font-mono text-gold-400">{r.quotation_number}</span> },
    { header: 'RFQ', render: (r) => <span className="text-white">{r.rfq_title}</span> },
    { header: 'Vendor', render: (r) => r.vendor_name },
    { header: 'Total Amount', render: (r) => <span className="font-medium text-white">₹{Number(r.total_amount).toLocaleString('en-IN')}</span> },
    { header: 'Timeline', accessor: 'delivery_timeline' },
    { header: 'Status', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[r.status]}`}>{r.status}</span> },
    { header: 'Actions', render: (r) => (
      <div className="flex gap-2">
        {!isVendor && r.status === 'submitted' && (
          <button onClick={() => navigate(`/quotations/compare/${r.rfq_id}`)} className="p-1.5 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-white" title="Compare">
            <GitCompare className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Quotations</h1>
          <p className="text-navy-400 mt-1">{quotations.length} quotation(s)</p>
        </div>
        {isVendor && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg hover:from-gold-300 hover:to-gold-400 transition-all">
            <Plus className="w-4 h-4" /> Submit Quotation
          </button>
        )}
      </div>

      <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl overflow-hidden">
        <DataTable columns={columns} data={quotations} loading={loading} emptyMessage="No quotations found" />
      </div>

      {/* Submit Quotation Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Submit Quotation" wide>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-1">Select RFQ *</label>
            <select value={form.rfq_id} onChange={e => handleRFQSelect(e.target.value)}
              className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none">
              <option value="">-- Select an open RFQ --</option>
              {rfqs.map(rfq => <option key={rfq.id} value={rfq.id}>{rfq.rfq_number} — {rfq.title}</option>)}
            </select>
          </div>

          {selectedRFQ && (
            <>
              <div className="p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
                <p className="text-sm text-white font-medium">{selectedRFQ.title}</p>
                <p className="text-xs text-navy-500 mt-1">Deadline: {selectedRFQ.deadline || 'Not set'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy-300 mb-2">Pricing for Each Item</label>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="flex gap-3 items-center py-2 px-3 bg-navy-800/30 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm text-white">{item.product_name}</p>
                        <p className="text-xs text-navy-500">Qty: {item.quantity}</p>
                      </div>
                      <div className="w-36">
                        <input type="number" value={item.unit_price || ''} onChange={e => updateItemPrice(i, e.target.value)}
                          placeholder="Unit price"
                          className="w-full px-3 py-1.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none text-right" />
                      </div>
                      <div className="w-28 text-right">
                        <p className="text-sm text-gold-400 font-medium">₹{(item.unit_price * item.quantity).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 border-t border-navy-700/30">
                    <p className="text-sm font-semibold text-white">Total: <span className="text-gold-400">₹{totalEstimate.toLocaleString('en-IN')}</span></p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Delivery Timeline</label>
              <input value={form.delivery_timeline} onChange={e => setForm(f => ({ ...f, delivery_timeline: e.target.value }))}
                placeholder="e.g., 2-3 weeks"
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-700/50">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-navy-400 text-sm">Cancel</button>
            <button onClick={handleSubmitQuotation} disabled={saving || !form.rfq_id}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg text-sm disabled:opacity-50">
              <Send className="w-4 h-4" /> {saving ? 'Submitting...' : 'Submit Quotation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
