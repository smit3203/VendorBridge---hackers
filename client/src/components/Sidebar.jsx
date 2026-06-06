import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, FileText, MessageSquareQuote,
  ShieldCheck, ShoppingCart, Activity, BarChart3, X, Package
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'procurement_officer', 'vendor', 'manager'] },
  { path: '/vendors', label: 'Vendors', icon: Users, roles: ['admin', 'procurement_officer'] },
  { path: '/rfqs', label: 'RFQs', icon: FileText, roles: ['admin', 'procurement_officer', 'vendor'] },
  { path: '/quotations', label: 'Quotations', icon: MessageSquareQuote, roles: ['admin', 'procurement_officer', 'vendor'] },
  { path: '/approvals', label: 'Approvals', icon: ShieldCheck, roles: ['admin', 'manager', 'procurement_officer'] },
  { path: '/purchase-orders', label: 'PO & Invoices', icon: ShoppingCart, roles: ['admin', 'procurement_officer', 'vendor'] },
  { path: '/activity-logs', label: 'Activity Logs', icon: Activity, roles: ['admin', 'procurement_officer', 'manager'] },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'procurement_officer', 'manager'] }
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  const filtered = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-navy-900 border-r border-navy-700/50
        flex flex-col
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-navy-700/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
            <Package className="w-4 h-4 text-navy-950" />
          </div>
          <span className="font-display font-semibold text-lg text-gold-400 tracking-tight">VendorBridge</span>
          <button onClick={onClose} className="ml-auto lg:hidden text-navy-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {filtered.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group
                  ${isActive
                    ? 'bg-gold-400/10 text-gold-400 border border-gold-400/20'
                    : 'text-navy-300 hover:bg-navy-800 hover:text-white border border-transparent'}
                `}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-gold-400' : 'text-navy-500 group-hover:text-navy-200'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Role badge */}
        <div className="p-4 border-t border-navy-700/50">
          <div className="px-3 py-2 rounded-lg bg-navy-800/50">
            <p className="text-xs text-navy-500 uppercase tracking-wider">Role</p>
            <p className="text-sm text-navy-200 font-medium capitalize mt-0.5">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
