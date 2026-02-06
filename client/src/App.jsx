import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ApartmentList from './components/apartments/ApartmentList';
import Login from './pages/Login';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="apartments" element={<ApartmentList />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
