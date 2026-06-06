import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import VendorManagement from './pages/VendorManagement';
import RFQCreation from './pages/RFQCreation';
import QuotationSubmission from './pages/QuotationSubmission';
import QuotationComparison from './pages/QuotationComparison';
import ApprovalWorkflow from './pages/ApprovalWorkflow';
import PurchaseOrderInvoice from './pages/PurchaseOrderInvoice';
import ActivityLogs from './pages/ActivityLogs';
import Reports from './pages/Reports';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-300 font-medium">Loading VendorBridge...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="vendors" element={<ProtectedRoute roles={['admin', 'procurement_officer']}><VendorManagement /></ProtectedRoute>} />
        <Route path="rfqs" element={<RFQCreation />} />
        <Route path="quotations" element={<QuotationSubmission />} />
        <Route path="quotations/compare/:rfqId" element={<ProtectedRoute roles={['admin', 'procurement_officer']}><QuotationComparison /></ProtectedRoute>} />
        <Route path="approvals" element={<ApprovalWorkflow />} />
        <Route path="purchase-orders" element={<PurchaseOrderInvoice />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="reports" element={<ProtectedRoute roles={['admin', 'procurement_officer', 'manager']}><Reports /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
