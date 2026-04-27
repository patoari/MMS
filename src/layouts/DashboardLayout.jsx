import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import SiteLogo from '../components/SiteLogo';
import {
  FiHome, FiUsers, FiDollarSign, FiFileText, FiCalendar,
  FiBell, FiLogOut, FiMenu, FiX, FiUser, FiBook, FiAward,
  FiSettings, FiArrowUp, FiImage, FiLayers, FiBarChart2, FiTrendingUp, FiUserCheck, FiClock, FiChevronDown, FiChevronRight, FiExternalLink, FiCheckSquare
} from 'react-icons/fi';
import './DashboardLayout.css';

const adminMenu = [
  { to: '/admin', label: 'ড্যাশবোর্ড', icon: <FiHome /> },
  { to: '/admin/sessions', label: 'শিক্ষাবর্ষ', icon: <FiClock /> },
  
  // Academic Management
  {
    label: 'একাডেমিক ব্যবস্থাপনা',
    icon: <FiBook />,
    isFolder: true,
    children: [
      { to: '/admin/classes', label: 'শ্রেণি ব্যবস্থাপনা', icon: <FiBook /> },
      { to: '/admin/subjects', label: 'বিষয় ব্যবস্থাপনা', icon: <FiLayers /> },
      { to: '/admin/routine', label: 'রুটিন', icon: <FiCalendar /> },
    ]
  },
  
  // Student Management
  {
    label: 'শিক্ষার্থী ব্যবস্থাপনা',
    icon: <FiUsers />,
    isFolder: true,
    children: [
      { to: '/admin/students', label: 'শিক্ষার্থী তালিকা', icon: <FiUsers /> },
      { to: '/admin/attendance', label: 'হাজিরা', icon: <FiCheckSquare /> },
      { to: '/admin/holidays', label: 'ছুটির দিন', icon: <FiCalendar /> },
      { to: '/admin/promotion', label: 'প্রমোশন', icon: <FiArrowUp /> },
    ]
  },
  
  // Teacher Management
  {
    label: 'শিক্ষক ব্যবস্থাপনা',
    icon: <FiUser />,
    isFolder: true,
    children: [
      { to: '/admin/teachers', label: 'শিক্ষক তালিকা', icon: <FiUsers /> },
      { to: '/admin/salary', label: 'বেতন', icon: <FiDollarSign /> },
    ]
  },
  
  // Exam Management
  {
    label: 'পরীক্ষা ব্যবস্থাপনা',
    icon: <FiCalendar />,
    isFolder: true,
    children: [
      { to: '/admin/exams', label: 'পরীক্ষা তালিকা', icon: <FiCalendar /> },
      { to: '/admin/marks', label: 'নম্বর প্রদান', icon: <FiAward /> },
      { to: '/admin/results', label: 'ফলাফল প্রকাশ', icon: <FiFileText /> },
    ]
  },
  
  // Financial Management
  {
    label: 'আর্থিক ব্যবস্থাপনা',
    icon: <FiDollarSign />,
    isFolder: true,
    children: [
      { to: '/admin/fees', label: 'ফি ব্যবস্থাপনা', icon: <FiDollarSign /> },
      { to: '/admin/receipts', label: 'রসিদ ব্যবস্থাপনা', icon: <FiFileText /> },
      { to: '/admin/transactions', label: 'আয় ও ব্যয়', icon: <FiTrendingUp /> },
      { to: '/admin/report', label: 'মাসিক রিপোর্ট', icon: <FiBarChart2 /> },
    ]
  },
  
  // Communication & Content
  {
    label: 'যোগাযোগ ও কন্টেন্ট',
    icon: <FiBell />,
    isFolder: true,
    children: [
      { to: '/admin/notices', label: 'নোটিশ', icon: <FiBell /> },
      { to: '/admin/gallery', label: 'গ্যালারি', icon: <FiImage /> },
    ]
  },
  
  // System Settings
  {
    label: 'সিস্টেম সেটিংস',
    icon: <FiSettings />,
    isFolder: true,
    children: [
      { to: '/admin/users', label: 'ব্যবহারকারী', icon: <FiUserCheck /> },
      { to: '/admin/settings', label: 'সাইট সেটিংস', icon: <FiSettings /> },
    ]
  },
];

const accountantMenu = [
  { to: '/admin', label: 'ড্যাশবোর্ড', icon: <FiHome /> },
  {
    label: 'আর্থিক ব্যবস্থাপনা',
    icon: <FiDollarSign />,
    isFolder: true,
    children: [
      { to: '/admin/fees', label: 'ফি ব্যবস্থাপনা', icon: <FiDollarSign /> },
      { to: '/admin/receipts', label: 'রসিদ ব্যবস্থাপনা', icon: <FiFileText /> },
      { to: '/admin/salary', label: 'বেতন', icon: <FiDollarSign /> },
      { to: '/admin/transactions', label: 'আয় ও ব্যয়', icon: <FiTrendingUp /> },
      { to: '/admin/report', label: 'মাসিক রিপোর্ট', icon: <FiBarChart2 /> },
    ]
  },
];

const teacherMenu = [
  { to: '/teacher', label: 'ড্যাশবোর্ড', icon: <FiHome /> },
  { to: '/teacher/students', label: 'শিক্ষার্থী তালিকা', icon: <FiUsers /> },
  { to: '/teacher/marks', label: 'নম্বর প্রদান', icon: <FiAward /> },
  { to: '/teacher/routine', label: 'রুটিন', icon: <FiCalendar /> },
  { to: '/teacher/notices', label: 'নোটিশ', icon: <FiBell /> },
];

const classTeacherMenu = [
  { to: '/teacher', label: 'ড্যাশবোর্ড', icon: <FiHome /> },
  { to: '/teacher/students', label: 'শিক্ষার্থী তালিকা', icon: <FiUsers /> },
  { to: '/teacher/attendance', label: 'হাজিরা', icon: <FiCheckSquare /> },
  { to: '/teacher/marks', label: 'নম্বর প্রদান', icon: <FiAward /> },
  { to: '/teacher/routine', label: 'রুটিন', icon: <FiCalendar /> },
  { to: '/teacher/notices', label: 'নোটিশ', icon: <FiBell /> },
];

const studentMenu = [
  { to: '/student', label: 'ড্যাশবোর্ড', icon: <FiHome /> },
  { to: '/student/profile', label: 'প্রোফাইল', icon: <FiUser /> },
  { to: '/student/result', label: 'ফলাফল', icon: <FiAward /> },
  { to: '/student/fees', label: 'ফি', icon: <FiDollarSign /> },
  { to: '/student/routine', label: 'রুটিন', icon: <FiCalendar /> },
  { to: '/student/notices', label: 'নোটিশ', icon: <FiBell /> },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});

  const menuMap = { admin: adminMenu, accountant: accountantMenu, teacher: teacherMenu, class_teacher: classTeacherMenu, student: studentMenu };
  const menu = menuMap[user?.role] || adminMenu;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleFolder = (label) => {
    setExpandedFolders(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const isChildActive = (children) => {
    return children?.some(child => location.pathname === child.to);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <SiteLogo size={36} />            <div>
              <div className="sidebar-brand-name">{settings.siteName}</div>
              <div className="sidebar-brand-role">
                {user?.role === 'admin' ? 'প্রশাসন' : user?.role === 'accountant' ? 'হিসাবরক্ষক' : user?.role === 'teacher' || user?.role === 'class_teacher' ? 'শিক্ষক' : 'শিক্ষার্থী'}
              </div>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><FiX /></button>
        </div>
        <nav className="sidebar-nav">
          {menu.map((item, index) => {
            if (item.isFolder) {
              const isExpanded = expandedFolders[item.label];
              const hasActiveChild = isChildActive(item.children);
              
              return (
                <div key={index} className="sidebar-folder">
                  <button
                    className={`sidebar-folder-toggle${hasActiveChild ? ' has-active' : ''}`}
                    onClick={() => toggleFolder(item.label)}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span className="sidebar-folder-label">{item.label}</span>
                    <span className="sidebar-folder-arrow">
                      {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="sidebar-folder-children">
                      {item.children.map(child => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`sidebar-link sidebar-link-child${location.pathname === child.to ? ' active' : ''}`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className="sidebar-link-icon">{child.icon}</span>
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-link${location.pathname === item.to ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <Link to="/" className="sidebar-homepage-link" target="_blank" rel="noopener noreferrer">
            <FiExternalLink /> হোমপেজ
          </Link>
          <button className="sidebar-logout" onClick={handleLogout}>
            <FiLogOut /> লগআউট
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="dashboard-main">
        {/* Topbar */}
        <header className="topbar">
          <button className="topbar-menu" onClick={() => setSidebarOpen(true)}><FiMenu /></button>
          <div className="topbar-title">
            {(() => {
              // Find direct menu item
              const directItem = menu.find(m => m.to === location.pathname);
              if (directItem) return directItem.label;
              
              // Find in folder children
              for (const item of menu) {
                if (item.isFolder && item.children) {
                  const childItem = item.children.find(c => c.to === location.pathname);
                  if (childItem) return childItem.label;
                }
              }
              
              return 'ড্যাশবোর্ড';
            })()}
          </div>
          <div className="topbar-user">
            <div className="topbar-avatar">{user?.name?.[0] || 'A'}</div>
            <div className="topbar-user-info">
              <div className="topbar-user-name">{user?.name}</div>
              <div className="topbar-user-role">
                {user?.role === 'admin' ? 'প্রশাসক' : user?.role === 'accountant' ? 'হিসাবরক্ষক' : user?.role === 'teacher' || user?.role === 'class_teacher' ? 'শিক্ষক' : 'শিক্ষার্থী'}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
