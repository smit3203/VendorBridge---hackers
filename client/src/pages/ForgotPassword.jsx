import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowLeft } from 'lucide-react';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setSent(true); // Show success even on error (prevent enumeration)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-navy-950" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Reset Password</h1>
        </div>

        <div className="bg-navy-900/80 border border-navy-700/50 rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">&#10003;</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Check your email</h3>
              <p className="text-navy-400 text-sm mb-6">
                If the email exists, we've sent a password reset link.
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 text-gold-400 hover:text-gold-300">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-navy-400 text-sm">Enter your email and we'll send a reset link.</p>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                placeholder="your@email.com"
              />
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-navy-400 hover:text-navy-200">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
