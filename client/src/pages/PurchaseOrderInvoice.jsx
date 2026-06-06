import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { ShoppingCart, FileText, Download, Mail, Plus, Eye } from 'lucide-react';

export default function PurchaseOrderInvoice() {
  const { user } = useAuth();
  const isVendor = user?.role === 'vendor';
  const [tab, setTab] = useState('po');
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/purchase-orders'),
      api.get('/invoices')
    ]).then(([poRes, invRes]) => {
      setPurchaseOrders(poRes.data.purchaseOrders);
      setInvoices(invRes.data.invoices);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const generateInvoice = async (poId) => {
    setGenerating(true);
    try {
      await api.post('/invoices', { po_id: poId });
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const downloadInvoice = (invoiceId) => {
    window.open(`/api/invoices/${invoiceId}/download?token=${localStorage.getItem('vb_token')}`, '_blank');
    // Alternatively, use fetch with auth header
    api.get(`/invoices/${invoiceId}/download`, { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }).catch(() => {});
  };

  const sendInvoice = async (invoiceId) => {
    setSending(true);
    try {
      await api.post(`/invoices/${invoiceId}/send`);
      alert('Invoice sent successfully');
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Send failed'); }
    finally { setSending(false); }
  };

  const viewDetail = async (type, id) => {
    try {
      const endpoint = type === 'po' ? `/purchase-orders/${id}` : `/invoices/${id}`;
      const res = await api.get(endpoint);
      setSelectedItem({ type, data: type === 'po' ? res.data.purchaseOrder : res.data.invoice });
      setShowDetail(true);
    } catch (err) { console.error(err); }
  };

  const poStatusColors = {
    draft: 'bg-navy-700 text-navy-300', confirmed: 'bg-green-500/10 text-green-400 border border-green-500/20',
    completed: 'bg-blue-500/10 text-blue-400', cancelled: 'bg-red-500/10 text-red-400'
  };
  const invStatusColors = {
    draft: 'bg-navy-700 text-navy-300', sent: 'bg-blue-500/10 text-blue-400',
    paid: 'bg-green-500/10 text-green-400', overdue: 'bg-red-500/10 text-red-400'
  };

  const poColumns = [
    { header: 'PO Number', render: (r) => <span className="font-mono text-gold-400">{r.po_number}</span> },
    { header: 'Vendor', render: (r) => <span className="text-white">{r.vendor_name}</span> },
    { header: 'RFQ', render: (r) => r.rfq_number },
    { header: 'Grand Total', render: (r) => <span className="font-medium text-white">₹{Number(r.grand_total).toLocaleString('en-IN')}</span> },
    { header: 'Status', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${poStatusColors[r.status]}`}>{r.status}</span> },
    { header: 'Actions', render: (r) => (
      <div className="flex gap-2">
        <button onClick={() => viewDetail('po', r.id)} className="p-1.5 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-white"><Eye className="w-4 h-4" /></button>
        {!isVendor && !invoices.find(inv => inv.po_id === r.id) && (
          <button onClick={() => generateInvoice(r.id)} disabled={generating}
            className="p-1.5 rounded-lg hover:bg-gold-400/10 text-navy-400 hover:text-gold-400" title="Generate Invoice">
            <FileText className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
  ];

  const invColumns = [
    { header: 'Invoice #', render: (r) => <span className="font-mono text-gold-400">{r.invoice_number}</span> },
    { header: 'PO #', render: (r) => r.po_number },
    { header: 'Vendor', render: (r) => <span className="text-white">{r.vendor_name}</span> },
    { header: 'Total', render: (r) => <span className="font-medium text-white">₹{Number(r.total).toLocaleString('en-IN')}</span> },
    { header: 'Status', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${invStatusColors[r.status]}`}>{r.status}</span> },
    { header: 'Actions', render: (r) => (
      <div className="flex gap-2">
        <button onClick={() => viewDetail('invoice', r.id)} className="p-1.5 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-white"><Eye className="w-4 h-4" /></button>
        <button onClick={() => downloadInvoice(r.id)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-navy-400 hover:text-blue-400" title="Download PDF"><Download className="w-4 h-4" /></button>
        {!isVendor && (
          <button onClick={() => sendInvoice(r.id)} disabled={sending} className="p-1.5 rounded-lg hover:bg-green-500/10 text-navy-400 hover:text-green-400" title="Send via Email"><Mail className="w-4 h-4" /></button>
        )}
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-white">Purchase Orders & Invoices</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-navy-900/50 rounded-xl w-fit border border-navy-700/30">
        <button onClick={() => setTab('po')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'po' ? 'bg-gold-400/10 text-gold-400 border border-gold-400/20' : 'text-navy-400 hover:text-white'}`}>
          <ShoppingCart className="w-4 h-4" /> Purchase Orders ({purchaseOrders.length})
        </button>
        <button onClick={() => setTab('invoice')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'invoice' ? 'bg-gold-400/10 text-gold-400 border border-gold-400/20' : 'text-navy-400 hover:text-white'}`}>
          <FileText className="w-4 h-4" /> Invoices ({invoices.length})
        </button>
      </div>

      <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl overflow-hidden">
        {tab === 'po' ? (
          <DataTable columns={poColumns} data={purchaseOrders} loading={loading} emptyMessage="No purchase orders" />
        ) : (
          <DataTable columns={invColumns} data={invoices} loading={loading} emptyMessage="No invoices" />
        )}
      </div>

      {/* Detail Modal */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title={selectedItem?.type === 'po' ? 'Purchase Order Details' : 'Invoice Details'} wide>
        {selectedItem && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {selectedItem.type === 'po' ? (
                <>
                  <div><p className="text-xs text-navy-500">PO Number</p><p className="font-mono text-gold-400">{selectedItem.data.po_number}</p></div>
                  <div><p className="text-xs text-navy-500">Status</p><p className="capitalize">{selectedItem.data.status}</p></div>
                  <div><p className="text-xs text-navy-500">Vendor</p><p className="text-white">{selectedItem.data.vendor_name}</p></div>
                  <div><p className="text-xs text-navy-500">RFQ</p><p>{selectedItem.data.rfq_number} — {selectedItem.data.rfq_title}</p></div>
                </>
              ) : (
                <>
                  <div><p className="text-xs text-navy-500">Invoice Number</p><p className="font-mono text-gold-400">{selectedItem.data.invoice_number}</p></div>
                  <div><p className="text-xs text-navy-500">Status</p><p className="capitalize">{selectedItem.data.status}</p></div>
                  <div><p className="text-xs text-navy-500">PO Number</p><p>{selectedItem.data.po_number}</p></div>
                  <div><p className="text-xs text-navy-500">Vendor</p><p className="text-white">{selectedItem.data.vendor_name}</p></div>
                </>
              )}
            </div>

            {/* Items */}
            <div>
              <h4 className="text-sm font-medium text-navy-300 mb-2">Line Items</h4>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-navy-700/50 text-navy-400 text-xs">
                  <th className="text-left py-2">Item</th><th className="text-center py-2">Qty</th><th className="text-right py-2">Unit Price</th><th className="text-right py-2">Total</th>
                </tr></thead>
                <tbody>
                  {selectedItem.data.items?.map((item, i) => (
                    <tr key={i} className="border-b border-navy-800/30">
                      <td className="py-2 text-white">{item.product_name}</td>
                      <td className="py-2 text-center">{item.quantity} {item.unit}</td>
                      <td className="py-2 text-right">₹{Number(item.unit_price).toLocaleString('en-IN')}</td>
                      <td className="py-2 text-right font-medium text-white">₹{Number(item.total_price).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-navy-400">Subtotal:</span>
                  <span>₹{Number(selectedItem.data.subtotal).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-navy-400">Tax ({selectedItem.data.tax_rate || 18}%):</span>
                  <span>₹{Number(selectedItem.data.tax_amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-navy-700 pt-2">
                  <span className="text-white">Grand Total:</span>
                  <span className="text-gold-400">₹{Number(selectedItem.data.grand_total || selectedItem.data.total).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
