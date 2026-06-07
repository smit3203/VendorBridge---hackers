import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatCard from '../components/StatCard';
import {
  Users, FileText, ShieldCheck, ShoppingCart,
  DollarSign, TrendingUp, Clock, ArrowRight,
  Plus, UserPlus, CheckSquare, BarChart3
} from 'lucide-react';

const statusColors = {
  draft: 'bg-navy-700 text-navy-300',
  open: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  closed: 'bg-navy-700 text-navy-400',
  awarded: 'bg-gold-400/10 text-gold-400 border border-gold-400/20',
  cancelled: 'bg-red-500/10 text-red-400',
  confirmed: 'bg-green-500/10 text-green-400 border border-green-500/20',
  draft_po: 'bg-navy-700 text-navy-400',
  sent: 'bg-blue-500/10 text-blue-400',
  paid: 'bg-green-500/10 text-green-400',
  overdue: 'bg-red-500/10 text-red-400',
  submitted: 'bg-yellow-500/10 text-yellow-400',
  selected: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
  completed: 'bg-green-500/10 text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-400',
  approved: 'bg-green-500/10 text-green-400'
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[status] || 'bg-navy-700 text-navy-300'}`}>
      {status}
    </span>
  );
}

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Welcome back, {user?.name}</h1>
        <p className="text-navy-400 mt-1">Here's your procurement overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Active Vendors" value={stats?.totalVendors || 0} icon={Users} color="blue" />
        <StatCard label="Active RFQs" value={stats?.activeRFQs || 0} icon={FileText} color="gold" />
        <StatCard label="Pending Approvals" value={stats?.pendingApprovals || 0} icon={ShieldCheck} color="red" />
        <StatCard label="Purchase Orders" value={stats?.totalPurchaseOrders || 0} icon={ShoppingCart} color="green" />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <StatCard label="Total PO Value" value={formatCurrency(stats?.totalPOValue)} icon={DollarSign} color="gold" />
        <StatCard label="Invoices Paid" value={formatCurrency(stats?.paidInvoiceValue)} icon={TrendingUp} color="green" />
        <StatCard label="Pending Invoices" value={formatCurrency(stats?.pendingInvoiceValue)} icon={Clock} color="blue" />
      </div>

      {/* Quick Actions */}
      <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-navy-300 uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {user?.role === 'procurement_officer' && (
            <>
              <Link
                to="/rfqs"
                state={{ openCreate: true }}
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-gold-400/10 text-gold-400 group-hover:bg-gold-400 group-hover:text-navy-950 transition-all">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Create RFQ</p>
                  <p className="text-xs text-navy-400 mt-0.5">Start new procurement</p>
                </div>
              </Link>

              <Link
                to="/vendors"
                state={{ openCreate: true }}
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Register Vendor</p>
                  <p className="text-xs text-navy-400 mt-0.5">Add a new supplier</p>
                </div>
              </Link>
            </>
          )}

          {user?.role === 'vendor' && (
            <>
              <Link
                to="/rfqs"
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-gold-400/10 text-gold-400 group-hover:bg-gold-400 group-hover:text-navy-950 transition-all">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">View RFQs</p>
                  <p className="text-xs text-navy-400 mt-0.5">Check invited requests</p>
                </div>
              </Link>

              <Link
                to="/quotations"
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Submit Quotation</p>
                  <p className="text-xs text-navy-400 mt-0.5">Respond to open RFQs</p>
                </div>
              </Link>
            </>
          )}

          {user?.role === 'manager' && (
            <>
              <Link
                to="/approvals"
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500 group-hover:text-white transition-all">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Approve Requests</p>
                  <p className="text-xs text-navy-400 mt-0.5">Process pending orders</p>
                </div>
              </Link>

              <Link
                to="/reports"
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-white transition-all">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">View Analytics</p>
                  <p className="text-xs text-navy-400 mt-0.5">Procurement spend reports</p>
                </div>
              </Link>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <Link
                to="/vendors"
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Manage Vendors</p>
                  <p className="text-xs text-navy-400 mt-0.5">Track supplier database</p>
                </div>
              </Link>

              <Link
                to="/reports"
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-navy-800/80 to-navy-900/80 border border-navy-700/50 hover:border-gold-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-white transition-all">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Procurement Reports</p>
                  <p className="text-xs text-navy-400 mt-0.5">ERP system metrics</p>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Recent Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent RFQs */}
        <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-navy-300 uppercase tracking-wider">Recent RFQs</h3>
            <Link to="/rfqs" className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.recentRFQs?.map(rfq => (
              <div key={rfq.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-navy-800/30 hover:bg-navy-800/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{rfq.title}</p>
                  <p className="text-xs text-navy-500">{rfq.rfq_number} &middot; {rfq.quotation_count} quotation(s)</p>
                </div>
                <StatusBadge status={rfq.status} />
              </div>
            ))}
            {(!stats?.recentRFQs || stats.recentRFQs.length === 0) && (
              <p className="text-navy-600 text-sm py-4 text-center">No RFQs yet</p>
            )}
          </div>
        </div>

        {/* Recent POs */}
        <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-navy-300 uppercase tracking-wider">Recent Purchase Orders</h3>
            <Link to="/purchase-orders" className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.recentPOs?.map(po => (
              <div key={po.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-navy-800/30 hover:bg-navy-800/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{po.po_number}</p>
                  <p className="text-xs text-navy-500">{po.vendor_name} &middot; {formatCurrency(po.grand_total)}</p>
                </div>
                <StatusBadge status={po.status} />
              </div>
            ))}
            {(!stats?.recentPOs || stats.recentPOs.length === 0) && (
              <p className="text-navy-600 text-sm py-4 text-center">No purchase orders yet</p>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-navy-300 uppercase tracking-wider">Recent Invoices</h3>
            <Link to="/purchase-orders" className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats?.recentInvoices?.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-navy-800/30 hover:bg-navy-800/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{inv.invoice_number}</p>
                  <p className="text-xs text-navy-500">{inv.vendor_name} &middot; {formatCurrency(inv.total)}</p>
                </div>
                <StatusBadge status={inv.status} />
              </div>
            ))}
            {(!stats?.recentInvoices || stats.recentInvoices.length === 0) && (
              <p className="text-navy-600 text-sm py-4 text-center col-span-2">No invoices yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
