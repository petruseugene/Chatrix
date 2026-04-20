import { Navigate, Route, Routes } from 'react-router-dom';
import AppBootstrap from './components/AppBootstrap';
import RequireAuth from './components/RequireAuth';
import AuthPage from './features/auth/AuthPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import DmLayout from './features/dm/DmLayout';

export default function App() {
  return (
    <AppBootstrap>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<div>Chat coming soon</div>} />
          <Route path="/dm" element={<DmLayout />} />
        </Route>
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </AppBootstrap>
  );
}
