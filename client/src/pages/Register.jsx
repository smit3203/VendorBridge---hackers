import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'procurement_officer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, role: form.role });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-gold-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-navy-950" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">VendorBridge</h1>
          <p className="text-navy-400 mt-2">Create your account</p>
        </div>

        <div className="bg-navy-900/80 backdrop-blur-md border border-navy-700/50 rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} required
                className="w-full px-4 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                placeholder="Your full name" />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required
                className="w-full px-4 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                placeholder="your@email.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Role</label>
              <select name="role" value={form.role} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white focus:outline-none focus:border-gold-400/50 transition-colors">
                <option value="procurement_officer">Procurement Officer</option>
                <option value="vendor">Vendor</option>
                <option value="manager">Manager / Approver</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} required
                className="w-full px-4 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                placeholder="Min. 6 characters" />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Confirm Password</label>
              <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required
                className="w-full px-4 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-navy-500 focus:outline-none focus:border-gold-400/50 transition-colors"
                placeholder="Confirm password" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold rounded-lg hover:from-gold-300 hover:to-gold-400 transition-all disabled:opacity-50">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-navy-400">
            Already have an account? <Link to="/login" className="text-gold-400 hover:text-gold-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
