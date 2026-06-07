import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, LogOut, User, Settings, ShieldAlert } from 'lucide-react';
import Modal from './Modal';
import api from '../services/api';

export default function Navbar({ onMenuToggle }) {
  const { user, setUser, logout } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync state with user name when modal opens or user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user, showProfileModal]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put('/auth/profile', {
        name,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined
      });
      setUser(res.data.user);
      setSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowProfileModal(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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

        {/* User / Settings Profile Trigger */}
        <div className="flex items-center gap-3 pl-4 border-l border-navy-700/50">
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left group"
            title="Profile Settings"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-400/30 flex items-center justify-center group-hover:border-gold-400 transition-colors">
              <User className="w-4 h-4 text-gold-400" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-navy-100 group-hover:text-gold-400 transition-colors">{user?.name}</p>
              <p className="text-xs text-navy-500">{user?.email}</p>
            </div>
          </button>

          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Profile Settings Modal */}
      <Modal
        open={showProfileModal}
        onClose={() => {
          if (!submitting) {
            setShowProfileModal(false);
            setError('');
            setSuccess('');
          }
        }}
        title="Profile Settings"
      >
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-400">
              {success}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wider mb-1.5">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full bg-navy-950/30 border border-navy-800/80 rounded-xl px-4 py-2.5 text-sm text-navy-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wider mb-1.5">Role</label>
            <input
              type="text"
              disabled
              value={user?.role?.replace('_', ' ') || ''}
              className="w-full bg-navy-950/30 border border-navy-800/80 rounded-xl px-4 py-2.5 text-sm text-navy-500 capitalize cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
            />
          </div>

          <div className="border-t border-navy-700/50 my-6 pt-4">
            <h3 className="text-sm font-semibold text-white mb-3">Change Password</h3>
            <p className="text-xs text-navy-400 mb-4">Leave password fields blank if you do not want to change your password.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wider mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wider mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-700/50">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowProfileModal(false);
                setError('');
                setSuccess('');
              }}
              className="px-5 py-2.5 rounded-xl border border-navy-700/50 hover:bg-navy-800 text-sm font-medium text-navy-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gold-400 hover:bg-gold-500 text-sm font-semibold text-navy-950 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center min-w-[100px]"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
