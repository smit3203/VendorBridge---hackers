import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Check, X, Star, Clock, DollarSign } from 'lucide-react';

export default function QuotationComparison() {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  const [rfq, setRfq] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initiatingApproval, setInitiatingApproval] = useState(false);
  const [managers, setManagers] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedManager, setSelectedManager] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rfqRes, quotRes] = await Promise.all([
          api.get(`/rfqs/${rfqId}`),
          api.get('/quotations', { params: { rfq_id: rfqId } })
        ]);
        setRfq(rfqRes.data.rfq);
        setQuotations(quotRes.data.quotations);

        // Fetch managers for approval initiation
        try {
          const usersRes = await api.get('/auth/users');
          setManagers(usersRes.data.users.filter(u => u.role === 'manager' || u.role === 'admin'));
        } catch { /* non-admin can't fetch users */ }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [rfqId]);

  const lowestPrice = quotations.length > 0 ? Math.min(...quotations.map(q => q.total_amount)) : 0;

  const handleInitiateApproval = async () => {
    if (!selectedQuote || !selectedManager) { alert('Select a quotation and approver'); return; }
    setInitiatingApproval(true);
    try {
      await api.post('/approvals', {
        rfq_id: parseInt(rfqId),
        quotation_id: selectedQuote,
        approver_id: parseInt(selectedManager)
      });
      alert('Approval request initiated successfully');
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setInitiatingApproval(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" /></div>;
  if (!rfq) return <div className="text-center py-20 text-navy-500">RFQ not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-navy-800 text-navy-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Quotation Comparison</h1>
          <p className="text-navy-400 mt-0.5">{rfq.rfq_number} — {rfq.title}</p>
        </div>
      </div>

      {quotations.length === 0 ? (
        <div className="text-center py-20 text-navy-500">No quotations received for this RFQ</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quotations.map((q, idx) => {
            const isLowest = q.total_amount === lowestPrice;
            const isSelected = selectedQuote === q.id;

            return (
              <div key={q.id}
                className={`relative bg-navy-900/70 border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02]
                  ${isSelected ? 'border-gold-400/50 ring-2 ring-gold-400/20' : 'border-navy-700/30 hover:border-navy-600'}
                  ${isLowest ? 'ring-1 ring-green-500/30' : ''}
                `}
                onClick={() => setSelectedQuote(q.id)}
              >
                {isLowest && (
                  <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-400 font-medium">
                    Lowest Price
                  </div>
                )}

                <div className="flex items-start justify-between mt-1">
                  <div>
                    <p className="text-sm text-navy-500">{q.quotation_number}</p>
                    <p className="text-lg font-semibold text-white mt-1">{q.vendor_name}</p>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-gold-400" />}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gold-400" />
                    <span className="text-2xl font-bold text-white">₹{Number(q.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-navy-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{q.delivery_timeline || 'Not specified'}</span>
                  </div>
                </div>

                {/* Items breakdown */}
                {q.items?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-navy-700/30 space-y-1.5">
                    {q.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-navy-400">{item.product_name} ({item.rfq_quantity}x)</span>
                        <span className="text-navy-200">₹{Number(item.unit_price).toLocaleString('en-IN')}/unit</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.notes && (
                  <p className="mt-3 text-xs text-navy-500 italic">{q.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approval Action */}
      {selectedQuote && managers.length > 0 && (
        <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-5 flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-1">Assign Approver</label>
            <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)}
              className="px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none min-w-[200px]">
              <option value="">Select approver...</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </div>
          <button onClick={handleInitiateApproval} disabled={initiatingApproval}
            className="px-6 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg text-sm disabled:opacity-50">
            {initiatingApproval ? 'Initiating...' : 'Initiate Approval'}
          </button>
        </div>
      )}
    </div>
  );
}
