import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import EmployeesPage from "@/pages/EmployeesPage";
import OldEmployeesPage from "@/pages/OldEmployeesPage";
import StructurePage from "@/pages/StructurePage";
import DesignationsPage from "@/pages/DesignationsPage";
import SettingsPage from "@/pages/SettingsPage";
import UsersRolesPage from "@/pages/UsersRolesPage";
import ImportIncumbencyPage from "@/pages/ImportIncumbencyPage";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grid-fade">
        <div className="rounded-3xl border border-border bg-surface px-6 py-4 text-sm font-semibold text-muted-foreground shadow-soft">
          Loading session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/incumbency" element={<EmployeesPage publicMode />} />
      <Route path="/incumbency-public" element={<EmployeesPage publicMode />} />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/old-employees" element={<OldEmployeesPage />} />
        <Route path="/old-employees/*" element={<OldEmployeesPage />} />
        <Route path="/oldemployees" element={<OldEmployeesPage />} />
        <Route path="/structure" element={<StructurePage />} />
        <Route path="/designations" element={<DesignationsPage />} />
        <Route path="/import" element={<ImportIncumbencyPage />} />
        <Route path="/import-incumbency" element={<ImportIncumbencyPage />} />
        <Route path="/employees/new" element={<Navigate to="/employees" replace />} />
        <Route path="/employees/:id" element={<Navigate to="/employees" replace />} />
        <Route path="/employees/:id/edit" element={<Navigate to="/employees" replace />} />
        <Route path="/wings" element={<Navigate to="/employees" replace />} />
        <Route path="/organization-structure" element={<Navigate to="/structure" replace />} />
        <Route path="/offices" element={<Navigate to="/structure" replace />} />
        <Route path="/seats" element={<Navigate to="/employees" replace />} />
        <Route path="/vacant-seats" element={<Navigate to="/employees" replace />} />
        <Route path="/additional-charge" element={<Navigate to="/employees" replace />} />
        <Route path="/transfers" element={<Navigate to="/employees" replace />} />
        <Route path="/leave" element={<Navigate to="/employees" replace />} />
        <Route path="/reports" element={<Navigate to="/employees" replace />} />
        <Route path="/users-roles" element={<UsersRolesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
