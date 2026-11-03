import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ProtectedRoute from "./components/ProtectedRoute";
import AssessmentPage from "./pages/AssessmentPage";
import ChatPage from "./pages/ChatPage";
import ComprehensiveAssessmentPage from "./pages/ComprehensiveAssessmentPage";
import DashboardPage from "./pages/DashboardPage";
import ForumPage from "./pages/ForumPage";
import HealthReportPage from "./pages/HealthReportPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ResultsPage from "./pages/ResultsPage";
import SensorPage from "./pages/SensorPage";
import VideoPage from "./pages/VideoPage";
import CallPage from "./pages/CallPage";


// Consultant pages

import PatientQueuePage from "./pages/PatientQueuePage";
import PatientSensorViewPage from "./pages/PatientSensorViewPage";
import ConsultationNotesPage from "./pages/ConsultationNotesPage";
import AppointmentsPage from "./pages/AppointmentsPage";

// Admin pages
import UserManagementPage from "./pages/UserManagementPage";
import SystemAnalyticsPage from "./pages/SystemAnalyticsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import PlatformSettingsPage from "./pages/PlatformSettingsPage";


function AppShell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <Topbar />
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isPublic = ['/', '/login'].includes(location.pathname);

  if (isPublic) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </div>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/home" element={
          localStorage.getItem("token")
            ? <Navigate to="/dashboard" replace />
            : <Navigate to="/login" replace />
        } />

        {/* Shared routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/forum" element={<ProtectedRoute><ForumPage /></ProtectedRoute>} />

        {/* Patient routes */}
        <Route path="/assessment" element={<ProtectedRoute allowedRoles={['patient']}><AssessmentPage /></ProtectedRoute>} />
        <Route path="/health-report" element={<ProtectedRoute allowedRoles={['patient', 'consultant']}><HealthReportPage /></ProtectedRoute>} />
        <Route path="/sensor" element={<ProtectedRoute allowedRoles={['patient']}><SensorPage /></ProtectedRoute>} />
        <Route path="/video" element={<ProtectedRoute allowedRoles={['patient']}><VideoPage /></ProtectedRoute>} />
        <Route path="/comprehensive-assessment" element={<ProtectedRoute allowedRoles={['patient']}><ComprehensiveAssessmentPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute allowedRoles={['patient']}><ChatPage /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute allowedRoles={['patient', 'consultant']}><ResultsPage /></ProtectedRoute>} />
        <Route path="/call/:roomId" element={<ProtectedRoute allowedRoles={['patient', 'consultant']}><CallPage /></ProtectedRoute>} />

        {/* Consultant routes */}
        <Route path="/patient-queue" element={<ProtectedRoute allowedRoles={['consultant']}><PatientQueuePage /></ProtectedRoute>} />
        <Route path="/patient-sensor-view" element={<ProtectedRoute allowedRoles={['consultant']}><PatientSensorViewPage /></ProtectedRoute>} />
        <Route path="/consultation-notes" element={<ProtectedRoute allowedRoles={['consultant']}><ConsultationNotesPage /></ProtectedRoute>} />
        <Route path="/appointments" element={<ProtectedRoute allowedRoles={['consultant']}><AppointmentsPage /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/user-management" element={<ProtectedRoute allowedRoles={['admin']}><UserManagementPage /></ProtectedRoute>} />
        <Route path="/system-analytics" element={<ProtectedRoute allowedRoles={['admin']}><SystemAnalyticsPage /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
        <Route path="/platform-settings" element={<ProtectedRoute allowedRoles={['admin']}><PlatformSettingsPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
