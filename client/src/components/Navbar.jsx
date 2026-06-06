import { useAuth } from '../context/AuthContext';
import { Menu, Bell, LogOut, User } from 'lucide-react';

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-navy-900/80 backdrop-blur-md border-b border-navy-700/50 flex items-center px-5 gap-4">
      <button
        onClick={onMenuToggle}
        className="p-2 rounded-lg hover:bg-navy-800 text-navy-400 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative p-2 rounded-lg hover:bg-navy-800 text-navy-400 hover:text-white transition-colors">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-400 rounded-full" />
      </button>

      {/* User */}
      <div className="flex items-center gap-3 pl-4 border-l border-navy-700/50">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-400/30 flex items-center justify-center">
          <User className="w-4 h-4 text-gold-400" />
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-navy-100">{user?.name}</p>
          <p className="text-xs text-navy-500">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
}
