import { Routes, Route, Navigate } from "react-router-dom";
import AuthGate from "@/components/AuthGate";
import LoginPage from "@/pages/LoginPage";
import ProjectListPage from "@/pages/ProjectListPage";
import NewProjectPage from "@/pages/NewProjectPage";
import ProjectMapPage from "@/pages/ProjectMapPage";
import ReportPage from "@/pages/ReportPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGate>
            <ProjectListPage />
          </AuthGate>
        }
      />
      <Route
        path="/new"
        element={
          <AuthGate>
            <NewProjectPage />
          </AuthGate>
        }
      />
      <Route
        path="/p/:id"
        element={
          <AuthGate>
            <ProjectMapPage />
          </AuthGate>
        }
      />
      <Route
        path="/p/:id/report"
        element={
          <AuthGate>
            <ReportPage />
          </AuthGate>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
