import { useState, useEffect } from 'react';
import api from '../services/api';
import StatCard from '../components/StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Users, Package } from 'lucide-react';

const CHART_COLORS = ['#e8b847', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899'];

function ChartCard({ title, children }) {
  return (
    <div className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-navy-300 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function Reports() {
  const [dashboard, setDashboard] = useState(null);
  const [vendorPerf, setVendorPerf] = useState([]);
  const [spending, setSpending] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    Promise.all([
      api.get('/reports/dashboard'),
      api.get('/reports/vendor-performance'),
      api.get('/reports/spending-summary', { params: { period } }),
      api.get('/reports/procurement-trends')
    ]).then(([dashRes, vpRes, spendRes, trendRes]) => {
      setDashboard(dashRes.data);
      setVendorPerf(vpRes.data.vendors);
      setSpending(spendRes.data);
      setTrends(trendRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-navy-800 border border-navy-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-navy-400 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm" style={{ color: p.color }}>
              {p.name}: {typeof p.value === 'number' && p.value > 1000 ? `₹${p.value.toLocaleString('en-IN')}` : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-navy-400 mt-1">Procurement insights and trends</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm focus:outline-none">
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Total PO Value" value={`₹${Number(dashboard?.totalPOValue || 0).toLocaleString('en-IN')}`} icon={DollarSign} color="gold" />
        <StatCard label="Active Vendors" value={dashboard?.totalVendors || 0} icon={Users} color="blue" />
        <StatCard label="Total POs" value={dashboard?.totalPurchaseOrders || 0} icon={Package} color="green" />
        <StatCard label="Paid Invoices" value={`₹${Number(dashboard?.paidInvoiceValue || 0).toLocaleString('en-IN')}`} icon={TrendingUp} color="purple" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Over Time */}
        <ChartCard title="Spending Over Time">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={spending?.spending || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3457" />
              <XAxis dataKey="period" stroke="#636b8f" fontSize={12} />
              <YAxis stroke="#636b8f" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_spending" name="Spending" fill="#e8b847" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Spending by Vendor */}
        <ChartCard title="Top Vendors by Spending">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={spending?.vendorSpending?.slice(0, 6) || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3457" />
              <XAxis type="number" stroke="#636b8f" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="company_name" stroke="#636b8f" fontSize={11} width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_spending" name="Spending" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* RFQ Status Distribution */}
        <ChartCard title="RFQ Status Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={trends?.rfqStatusDistribution || []} dataKey="count" nameKey="status"
                cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={4} label={({ status, count }) => `${status}: ${count}`}>
                {(trends?.rfqStatusDistribution || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Monthly RFQ Trend */}
        <ChartCard title="Monthly RFQ Trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trends?.monthlyRFQs || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3457" />
              <XAxis dataKey="month" stroke="#636b8f" fontSize={12} />
              <YAxis stroke="#636b8f" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" name="RFQs" stroke="#e8b847" strokeWidth={2} dot={{ fill: '#e8b847', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Vendor Performance Table */}
      <ChartCard title="Vendor Performance">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700/50 text-navy-400 text-xs">
                <th className="text-left py-2 px-3">Vendor</th>
                <th className="text-center py-2 px-3">Quotations</th>
                <th className="text-center py-2 px-3">Won</th>
                <th className="text-center py-2 px-3">Win Rate</th>
                <th className="text-center py-2 px-3">Orders</th>
                <th className="text-right py-2 px-3">Total Value</th>
                <th className="text-center py-2 px-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {vendorPerf.map((v, i) => (
                <tr key={v.id} className="border-b border-navy-800/30 hover:bg-navy-800/20">
                  <td className="py-2.5 px-3 text-white font-medium">{v.company_name}</td>
                  <td className="py-2.5 px-3 text-center">{v.total_quotations}</td>
                  <td className="py-2.5 px-3 text-center text-green-400">{v.won_quotations}</td>
                  <td className="py-2.5 px-3 text-center">
                    {v.total_quotations > 0 ? `${((v.won_quotations / v.total_quotations) * 100).toFixed(0)}%` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center">{v.total_pos}</td>
                  <td className="py-2.5 px-3 text-right text-gold-400 font-medium">₹{Number(v.total_order_value).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-center text-gold-400">{v.rating || '-'}</td>
                </tr>
              ))}
              {vendorPerf.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-navy-500">No vendor data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
