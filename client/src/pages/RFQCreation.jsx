import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Plus, Search, Eye, X, Send } from 'lucide-react';

export default function RFQCreation() {
  const { user } = useAuth();
  const isVendor = user?.role === 'vendor';
  const [rfqs, setRfqs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', deadline: '', status: 'draft',
    items: [{ product_name: '', description: '', quantity: 1, unit: 'pcs' }],
    vendor_ids: []
  });

  const fetchRFQs = () => {
    setLoading(true);
    api.get('/rfqs', { params: { search, status: filterStatus } })
      .then(res => { setRfqs(res.data.rfqs); setTotal(res.data.total); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchRFQs(); }, [search, filterStatus]);

  useEffect(() => {
    if (!isVendor) {
      api.get('/vendors', { params: { status: 'active', limit: 100 } })
        .then(res => setVendors(res.data.vendors)).catch(console.error);
    }
  }, [isVendor]);

  const resetForm = () => {
    setForm({ title: '', description: '', deadline: '', status: 'draft',
      items: [{ product_name: '', description: '', quantity: 1, unit: 'pcs' }], vendor_ids: [] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/rfqs', form);
      setShowModal(false);
      resetForm();
      fetchRFQs();
    } catch (err) { alert(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handlePublish = async (id) => {
    try {
      await api.put(`/rfqs/${id}`, { status: 'open' });
      fetchRFQs();
    } catch (err) { alert(err.response?.data?.error || 'Publish failed'); }
  };

  const viewDetail = async (id) => {
    try {
      const res = await api.get(`/rfqs/${id}`);
      setSelectedRFQ(res.data.rfq);
      setShowDetail(true);
    } catch (err) { console.error(err); }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_name: '', description: '', quantity: 1, unit: 'pcs' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }));
  const toggleVendor = (id) => setForm(f => ({ ...f, vendor_ids: f.vendor_ids.includes(id) ? f.vendor_ids.filter(v => v !== id) : [...f.vendor_ids, id] }));

  const statusColors = {
    draft: 'bg-navy-700 text-navy-300', open: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    closed: 'bg-navy-700 text-navy-400', awarded: 'bg-gold-400/10 text-gold-400 border border-gold-400/20',
    cancelled: 'bg-red-500/10 text-red-400'
  };

  const columns = [
    { header: 'RFQ Number', render: (r) => <span className="font-mono text-gold-400">{r.rfq_number}</span> },
    { header: 'Title', render: (r) => <span className="font-medium text-white">{r.title}</span> },
    { header: 'Deadline', render: (r) => r.deadline || '-' },
    { header: 'Items', render: (r) => r.items?.length || 0 },
    { header: 'Quotations', render: (r) => r.quotation_count || 0 },
    { header: 'Status', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[r.status]}`}>{r.status}</span> },
    { header: 'Actions', render: (r) => (
      <div className="flex gap-2">
        <button onClick={() => viewDetail(r.id)} className="p-1.5 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-white"><Eye className="w-4 h-4" /></button>
        {r.status === 'draft' && !isVendor && (
          <button onClick={() => handlePublish(r.id)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-navy-400 hover:text-blue-400" title="Publish RFQ">
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Request for Quotations</h1>
          <p className="text-navy-400 mt-1">{total} RFQ(s)</p>
        </div>
        {!isVendor && (
          <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg hover:from-gold-300 hover:to-gold-400 transition-all">
            <Plus className="w-4 h-4" /> Create RFQ
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search RFQs..."
            className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white focus:outline-none text-sm">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option><option value="open">Open</option>
          <option value="closed">Closed</option><option value="awarded">Awarded</option>
        </select>
      </div>

      <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl overflow-hidden">
        <DataTable columns={columns} data={rfqs} loading={loading} emptyMessage="No RFQs found" />
      </div>

      {/* Create Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create RFQ" wide>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Deadline</label>
              <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none resize-none" />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-navy-300">Line Items</label>
              <button onClick={addItem} className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input placeholder="Product name" value={item.product_name} onChange={e => updateItem(i, 'product_name', e.target.value)}
                    className="flex-1 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none" />
                  <input placeholder="Desc" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                    className="w-32 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-20 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none" />
                  <input placeholder="Unit" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
                    className="w-16 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none" />
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="p-2 text-navy-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vendor Selection */}
          {vendors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Assign Vendors</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {vendors.map(v => (
                  <label key={v.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm border transition-colors ${form.vendor_ids.includes(v.id) ? 'border-gold-400/30 bg-gold-400/5 text-white' : 'border-navy-700 text-navy-400 hover:border-navy-600'}`}>
                    <input type="checkbox" checked={form.vendor_ids.includes(v.id)} onChange={() => toggleVendor(v.id)} className="accent-gold-400" />
                    {v.company_name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-700/50">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-navy-400 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Creating...' : 'Create RFQ'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title="RFQ Details" wide>
        {selectedRFQ && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-navy-500">RFQ Number</p><p className="font-mono text-gold-400">{selectedRFQ.rfq_number}</p></div>
              <div><p className="text-xs text-navy-500">Status</p><p className="capitalize">{selectedRFQ.status}</p></div>
              <div><p className="text-xs text-navy-500">Title</p><p className="text-white font-medium">{selectedRFQ.title}</p></div>
              <div><p className="text-xs text-navy-500">Deadline</p><p>{selectedRFQ.deadline || 'Not set'}</p></div>
            </div>
            {selectedRFQ.description && <div><p className="text-xs text-navy-500 mb-1">Description</p><p className="text-sm text-navy-300">{selectedRFQ.description}</p></div>}

            <div>
              <h4 className="text-sm font-medium text-navy-300 mb-2">Line Items ({selectedRFQ.items?.length})</h4>
              <div className="space-y-1">
                {selectedRFQ.items?.map(item => (
                  <div key={item.id} className="flex justify-between py-2 px-3 bg-navy-800/30 rounded-lg text-sm">
                    <span className="text-white">{item.product_name}</span>
                    <span className="text-navy-400">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedRFQ.vendors?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-navy-300 mb-2">Assigned Vendors</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRFQ.vendors.map(v => (
                    <span key={v.id} className="px-3 py-1 bg-navy-800 border border-navy-700 rounded-full text-xs text-navy-300">{v.company_name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
