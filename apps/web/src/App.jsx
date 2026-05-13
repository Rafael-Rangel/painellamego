import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPage from "./pages/AdminPage";
import ComponentLibraryPage from "./pages/ComponentLibraryPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import ManagerPage from "./pages/ManagerPage";
import ManagerPurchasePage from "./pages/ManagerPurchasePage";
import ManagerPurchaseAiPage from "./pages/ManagerPurchaseAiPage";
import OnboardingPage from "./pages/OnboardingPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/manager"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute role="manager">
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute role="manager">
              <ManagerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/alerts"
          element={
            <ProtectedRoute role="manager">
              <ManagerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/new-purchase"
          element={
            <ProtectedRoute role="manager">
              <ManagerPurchasePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/new-purchase/ai"
          element={
            <ProtectedRoute role="manager">
              <ManagerPurchaseAiPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="/design-system" element={<ComponentLibraryPage />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AuthProvider>
  );
}
