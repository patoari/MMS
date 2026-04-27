import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudentProvider } from './context/StudentContext';
import { FeeProvider } from './context/FeeContext';
import { SiteSettingsProvider, useSiteSettings } from './context/SiteSettingsContext';
import { GalleryProvider } from './context/GalleryContext';
import { RoutineProvider } from './context/RoutineContext';
import { SessionFilterProvider } from './context/SessionFilterContext';
import { useFavicon } from './hooks/useFavicon';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import AccountantRoute from './routes/AccountantRoute';

// Public Pages
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import ResultCheck from './pages/ResultCheck';
import StudentVerify from './pages/StudentVerify';
import NoticePage from './pages/NoticePage';
import ClassRoutinePage from './pages/ClassRoutinePage';
import ExamRoutinePage from './pages/ExamRoutinePage';
import StaticPage from './pages/StaticPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentList from './pages/admin/StudentList';
import FeeList from './pages/admin/FeeList';
import ExamList from './pages/admin/ExamList';
import MarksEntry from './pages/admin/MarksEntry';
import ResultPublish from './pages/admin/ResultPublish';
import NoticeList from './pages/admin/NoticeList';
import SalaryList from './pages/admin/SalaryList';
import ReceiptsList from './pages/admin/ReceiptsList';
import TeacherList from './pages/admin/TeacherList';
import AdminRoutine from './pages/admin/AdminRoutine';
import GalleryManager from './pages/admin/GalleryManager';
import MonthlyReport from './pages/admin/MonthlyReport';
import SiteSettings from './pages/admin/SiteSettings';
import SubjectManager from './pages/admin/SubjectManager';
import StudentPromotion from './pages/admin/StudentPromotion';
import Transactions from './pages/admin/Transactions';
import UserManagement from './pages/admin/UserManagement';
import SessionManager from './pages/admin/SessionManager';
import ClassManager from './pages/admin/ClassManager';
import AdminAttendance from './pages/admin/AdminAttendance';
import HolidayManager from './pages/admin/HolidayManager';

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherStudents from './pages/teacher/TeacherStudents';
import TeacherNotices from './pages/teacher/TeacherNotices';
import TeacherRoutine from './pages/teacher/TeacherRoutine';
import TeacherAttendance from './pages/teacher/TeacherAttendance';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentProfile from './pages/student/StudentProfile';
import StudentResult from './pages/student/StudentResult';
import StudentFees from './pages/student/StudentFees';
import StudentRoutine from './pages/student/StudentRoutine';
import StudentNotices from './pages/student/StudentNotices';

function AppRoutes() {
  const { initAuth } = useAuth();
  const { settings } = useSiteSettings();
  
  // Update favicon dynamically based on logo
  useFavicon(settings.logoUrl);
  
  // Update document title
  useEffect(() => {
    if (settings.siteName) {
      document.title = settings.siteName;
    }
  }, [settings.siteName]);
  
  useEffect(() => { initAuth(); }, []);

  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/result-check" element={<ResultCheck />} />
        <Route path="/student-verify" element={<StudentVerify />} />
        <Route path="/notice" element={<NoticePage />} />
        <Route path="/class-routine" element={<ClassRoutinePage />} />
        <Route path="/exam-routine" element={<ExamRoutinePage />} />
        <Route path="/privacy" element={<StaticPage page="privacy" />} />
        <Route path="/terms" element={<StaticPage page="terms" />} />
        <Route path="/sitemap" element={<StaticPage page="sitemap" />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute role={["admin", "accountant"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AccountantRoute><AdminDashboard /></AccountantRoute>} />
        <Route path="students" element={<AccountantRoute><StudentList /></AccountantRoute>} />
        <Route path="fees" element={<FeeList />} />
        <Route path="exams" element={<AccountantRoute><ExamList /></AccountantRoute>} />
        <Route path="marks" element={<AccountantRoute><MarksEntry /></AccountantRoute>} />
        <Route path="results" element={<AccountantRoute><ResultPublish /></AccountantRoute>} />
        <Route path="notices" element={<AccountantRoute><NoticeList /></AccountantRoute>} />
        <Route path="salary" element={<SalaryList />} />
        <Route path="receipts" element={<ReceiptsList />} />
        <Route path="teachers" element={<AccountantRoute><TeacherList /></AccountantRoute>} />
        <Route path="routine" element={<AccountantRoute><AdminRoutine /></AccountantRoute>} />
        <Route path="gallery" element={<AccountantRoute><GalleryManager /></AccountantRoute>} />
        <Route path="report" element={<MonthlyReport />} />
        <Route path="sessions" element={<AccountantRoute><SessionManager /></AccountantRoute>} />
        <Route path="subjects" element={<AccountantRoute><SubjectManager /></AccountantRoute>} />
        <Route path="classes" element={<AccountantRoute><ClassManager /></AccountantRoute>} />
        <Route path="promotion" element={<AccountantRoute><StudentPromotion /></AccountantRoute>} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="settings" element={<AccountantRoute><SiteSettings /></AccountantRoute>} />
        <Route path="users" element={<AccountantRoute><UserManagement /></AccountantRoute>} />
        <Route path="attendance" element={<AccountantRoute><AdminAttendance /></AccountantRoute>} />
        <Route path="holidays" element={<AccountantRoute><HolidayManager /></AccountantRoute>} />
      </Route>

      {/* Teacher Routes */}
      <Route path="/teacher" element={
        <ProtectedRoute role={["teacher", "class_teacher"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<TeacherDashboard />} />
        <Route path="students" element={<TeacherStudents />} />
        <Route path="marks" element={<MarksEntry />} />
        <Route path="routine" element={<TeacherRoutine />} />
        <Route path="notices" element={<TeacherNotices />} />
        <Route path="attendance" element={<TeacherAttendance />} />
      </Route>

      {/* Student Routes */}
      <Route path="/student" element={
        <ProtectedRoute role="student">
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<StudentDashboard />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="result" element={<StudentResult />} />
        <Route path="fees" element={<StudentFees />} />
        <Route path="routine" element={<StudentRoutine />} />
        <Route path="notices" element={<StudentNotices />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SiteSettingsProvider>
          <GalleryProvider>
            <RoutineProvider>
              <SessionFilterProvider>
                <StudentProvider>
                  <FeeProvider>
                    <AppRoutes />
                  </FeeProvider>
                </StudentProvider>
              </SessionFilterProvider>
            </RoutineProvider>
          </GalleryProvider>
        </SiteSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
