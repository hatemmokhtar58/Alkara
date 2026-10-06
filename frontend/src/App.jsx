import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import Customers from './pages/Customers';
import Cars from './pages/Cars';
import CreateTrip from './pages/CreateTrip';
import TripsLog from './pages/TripsLog';
import CreateExpense from './pages/CreateExpense';
import ExpensesLog from './pages/ExpensesLog';
import Wallet from './pages/Wallet';
import AccountStatement from './pages/AccountStatement';
import Statements from './pages/Statements';
import Salaries from './pages/Salaries';
import DailyReport from './pages/DailyReport';
import Login from './pages/Login';
import Users from './pages/Users';
import SmsLog from './pages/SmsLog';
import AuditLog from './pages/AuditLog';
import ChangePassword from './pages/ChangePassword';

import api from './api';
import logo from './assets/logo.webp';

import { useToast } from './context/ToastContext';

const ADMIN = 'admin';

// Every page, the permission that opens it, and whether it shows in the top menu or the reports menu.
const PAGES = [
  { path: '/', perm: 'trips', label: 'Sidebar.Dashboard', menu: 'main', element: () => <Dashboard /> },
  { path: '/trips-log', perm: 'trips', label: 'Sidebar.TripsLog', menu: 'main', element: () => <TripsLog /> },
  { path: '/trip-create', perm: 'trips', element: () => <CreateTrip /> },
  { path: '/drivers', perm: 'fleet', label: 'Sidebar.Drivers', menu: 'main', element: () => <Drivers /> },
  { path: '/customers', perm: 'fleet', label: 'Sidebar.Customers', menu: 'main', element: () => <Customers /> },
  { path: '/cars', perm: 'fleet', label: 'Sidebar.Cars', menu: 'main', element: () => <Cars /> },
  { path: '/expense-create', perm: 'expenses', label: 'Sidebar.CreateExpense', menu: 'main', element: () => <CreateExpense /> },
  { path: '/expenses-log', perm: 'expenses', label: 'Sidebar.ExpensesLog', menu: 'main', element: () => <ExpensesLog /> },
  { path: '/wallet', perm: 'wallet', label: 'Sidebar.Wallet', menu: 'main', element: () => <Wallet /> },
  { path: '/account-statement', perm: 'wallet', label: 'Sidebar.AccountStatement', menu: 'reports', element: () => <AccountStatement /> },
  { path: '/statement-daily', perm: 'reports', text: 'كشف حساب يومي', menu: 'reports', element: () => <Statements period="daily" /> },
  { path: '/statement-monthly', perm: 'reports', text: 'كشف حساب شهري', menu: 'reports', element: () => <Statements period="monthly" /> },
  { path: '/statement-yearly', perm: 'reports', text: 'كشف حساب سنوي', menu: 'reports', element: () => <Statements period="yearly" /> },
  { path: '/salaries', perm: 'reports', label: 'Sidebar.Salaries', menu: 'reports', element: () => <Salaries /> },
  { path: '/daily-report', perm: 'reports', text: 'التقرير اليومي', menu: 'reports', element: () => <DailyReport period="daily" /> },
  { path: '/monthly-report', perm: 'reports', text: 'التقرير الشهري', menu: 'reports', element: () => <DailyReport period="monthly" /> },
  { path: '/yearly-report', perm: 'reports', text: 'التقرير السنوي', menu: 'reports', element: () => <DailyReport period="yearly" /> },
  { path: '/users', perm: ADMIN, label: 'Sidebar.Users', menu: 'main', element: () => <Users /> },
  { path: '/sms-log', perm: ADMIN, text: 'سجل الرسائل', menu: 'reports', element: () => <SmsLog /> },
  { path: '/audit-log', perm: ADMIN, text: 'سجل التعديلات', menu: 'reports', element: () => <AuditLog /> },
];

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

function App() {
  const { showToast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState(readStoredUser);

  useEffect(() => {
    const handleSystemError = (e) => showToast(e.detail, 'error');
    window.addEventListener('system-error', handleSystemError);
    return () => window.removeEventListener('system-error', handleSystemError);
  }, [showToast]);

  const saveUser = useCallback((u) => {
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  }, []);

  // Role and permissions can change after login, so refresh them from the server on every load.
  useEffect(() => {
    if (!isAuthenticated) return;
    setUser(readStoredUser());
    api.get('/Auth/me').then(res => saveUser(res.data)).catch(() => {});
  }, [isAuthenticated, saveUser]);

  // The server says this account must set a new password first.
  useEffect(() => {
    const handleMustChange = () => setUser(u => (u ? { ...u, mustChangePassword: true } : u));
    window.addEventListener('must-change-password', handleMustChange);
    return () => window.removeEventListener('must-change-password', handleMustChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const handlePasswordChanged = (data) => {
    localStorage.setItem('token', data.token);
    saveUser(data.user);
  };

  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <AppShell user={user} onLogout={handleLogout} onPasswordChanged={handlePasswordChanged} />
    </Router>
  );
}

function AppShell({ user, onLogout, onPasswordChanged }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const isAdmin = user?.role === 'Admin';
  const granted = (user?.permissions || '').split(',').filter(Boolean);
  const canOpen = (perm) => isAdmin || (perm !== ADMIN && granted.includes(perm));

  const pages = PAGES.filter(p => canOpen(p.perm));
  const mainLinks = pages.filter(p => p.menu === 'main');
  const reportLinks = pages.filter(p => p.menu === 'reports');
  const homePath = pages[0]?.path;

  const isActive = (path) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const linkText = (p) => (p.label ? t(p.label) : p.text);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.body.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const closeMenu = () => setIsMenuOpen(false);

  if (user?.mustChangePassword || showChangePassword) {
    return (
      <ChangePassword
        forced={!!user?.mustChangePassword}
        onDone={(data) => { onPasswordChanged(data); setShowChangePassword(false); }}
        onCancel={() => setShowChangePassword(false)}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div className="app-layout" translate="no">
      {/* Top Navigation Bar */}
      <nav className="top-navbar">
        <div className="navbar-brand">
          <img src={logo} alt="Alkara" style={{ height: '36px', objectFit: 'contain' }} />
        </div>

        <div className="navbar-links">
          {mainLinks.map(p => (
            <Link key={p.path} to={p.path} className={`navbar-link ${isActive(p.path) ? 'active' : ''}`}>
              <span className="link-text">{linkText(p)}</span>
            </Link>
          ))}
          {reportLinks.length > 0 && (
            <div className="navbar-dropdown">
              <span className={`navbar-link ${reportLinks.some(p => isActive(p.path)) ? 'active' : ''}`}>
                <span className="link-text">التقارير ▾</span>
              </span>
              <div className="navbar-dropdown-menu">
                {reportLinks.map(p => (
                  <Link key={p.path} to={p.path} className="navbar-dropdown-item">
                    {linkText(p)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="navbar-actions">
          <button onClick={() => setShowChangePassword(true)} className="navbar-lang-btn" title="تغيير كلمة المرور">
            🔑
          </button>
          <button onClick={toggleLanguage} className="navbar-lang-btn">
            {i18n.language === 'ar' ? 'EN' : 'AR'}
          </button>
          <button onClick={onLogout} className="navbar-logout-btn">
            {t('Sidebar.Logout')}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="navbar-hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          ☰
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {isMenuOpen && (
        <>
          <div className="mobile-nav-overlay" onClick={closeMenu}></div>
          <div className="mobile-nav-dropdown">
            {[...mainLinks, ...reportLinks].map(p => (
              <Link key={p.path} to={p.path} onClick={closeMenu} className={`mobile-nav-link ${isActive(p.path) ? 'active' : ''}`}>
                {linkText(p)}
              </Link>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setShowChangePassword(true); closeMenu(); }} className="navbar-lang-btn" style={{ flex: 1 }}>
                🔑
              </button>
              <button onClick={() => { toggleLanguage(); closeMenu(); }} className="navbar-lang-btn" style={{ flex: 1 }}>
                {i18n.language === 'ar' ? 'EN' : 'AR'}
              </button>
              <button onClick={() => { onLogout(); closeMenu(); }} className="navbar-logout-btn" style={{ flex: 1 }}>
                {t('Sidebar.Logout')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main-content navbar-main">
        {homePath ? (
          <Routes>
            {pages.map(p => (
              <Route key={p.path} path={p.path} element={p.element()} />
            ))}
            <Route path="*" element={<Navigate to={homePath} replace />} />
          </Routes>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            لا توجد صلاحيات على حسابك حتى الآن. تواصل مع مدير النظام.
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
