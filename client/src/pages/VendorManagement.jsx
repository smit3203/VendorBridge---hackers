import { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Plus, Search, Edit2, Trash2, Star } from 'lucide-react';

const emptyForm = { company_name: '', contact_person: '', email: '', phone: '', address: '', gst_number: '', category: '', status: 'active' };

export default function VendorManagement() {
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchVendors = () => {
    setLoading(true);
    const params = { search, status: filterStatus };
    api.get('/vendors', { params })
      .then(res => { setVendors(res.data.vendors); setTotal(res.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVendors(); }, [search, filterStatus]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (v) => { setForm({ ...v }); setEditId(v.id); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/vendors/${editId}`, form);
      } else {
        await api.post('/vendors', form);
      }
      setShowModal(false);
      fetchVendors();
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this vendor?')) return;
    try {
      await api.delete(`/vendors/${id}`);
      fetchVendors();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const columns = [
    { header: 'Company', render: (r) => (
      <div>
        <p className="font-medium text-white">{r.company_name}</p>
        <p className="text-xs text-navy-500">{r.contact_person}</p>
      </div>
    )},
    { header: 'Email', accessor: 'email' },
    { header: 'Category', accessor: 'category', render: (r) => r.category || '-' },
    { header: 'GST', accessor: 'gst_number', render: (r) => r.gst_number || '-' },
    { header: 'Rating', render: (r) => (
      <div className="flex items-center gap-1">
        <Star className="w-3.5 h-3.5 text-gold-400 fill-gold-400" />
        <span>{r.rating || 0}</span>
      </div>
    )},
    { header: 'Status', render: (r) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${r.status === 'active' ? 'bg-green-500/10 text-green-400' : r.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-navy-700 text-navy-400'}`}>
        {r.status}
      </span>
    )},
    { header: 'Actions', render: (r) => (
      <div className="flex gap-2">
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-white transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Vendor Management</h1>
          <p className="text-navy-400 mt-1">{total} vendor(s) registered</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg hover:from-gold-300 hover:to-gold-400 transition-all shadow-lg shadow-gold-400/20">
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 text-sm"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white focus:outline-none focus:border-gold-400/50 text-sm">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl overflow-hidden">
        <DataTable columns={columns} data={vendors} loading={loading} emptyMessage="No vendors found" />
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Vendor' : 'Add Vendor'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Company Name *</label>
              <input name="company_name" value={form.company_name || ''} onChange={handleChange}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Contact Person *</label>
              <input name="contact_person" value={form.contact_person || ''} onChange={handleChange}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Email *</label>
              <input name="email" type="email" value={form.email || ''} onChange={handleChange}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Phone</label>
              <input name="phone" value={form.phone || ''} onChange={handleChange}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-1">Address</label>
            <textarea name="address" value={form.address || ''} onChange={handleChange} rows={2}
              className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50 resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">GST Number</label>
              <input name="gst_number" value={form.gst_number || ''} onChange={handleChange}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Category</label>
              <input name="category" value={form.category || ''} onChange={handleChange}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Status</label>
              <select name="status" value={form.status || 'active'} onChange={handleChange}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/50">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-navy-700/50">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-navy-400 hover:text-white transition-colors text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
