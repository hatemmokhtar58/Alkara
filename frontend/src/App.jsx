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
import DriverEarnings from './pages/DriverEarnings';
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

// Every page, the permission that opens it, and where it shows: the top menu, or a group in the reports menu.
// Pages without a menu are reached from tabs on a related page (daily / monthly / yearly, add / log);
// `also` lists them so the menu entry stays highlighted there.
const PAGES = [
  { path: '/', perm: 'trips', label: 'Sidebar.Dashboard', menu: 'main', element: () => <Dashboard /> },
  { path: '/trips-log', perm: 'trips', label: 'Sidebar.TripsLog', menu: 'main', element: () => <TripsLog /> },
  { path: '/trip-create', perm: 'trips', element: () => <CreateTrip /> },
  { path: '/drivers', perm: 'fleet', label: 'Sidebar.Drivers', menu: 'main', element: () => <Drivers /> },
  { path: '/customers', perm: 'fleet', label: 'Sidebar.Customers', menu: 'main', element: () => <Customers /> },
  { path: '/cars', perm: 'fleet', label: 'Sidebar.Cars', menu: 'main', element: () => <Cars /> },
  { path: '/expenses-log', perm: 'expenses', label: 'Sidebar.Expenses', menu: 'main', also: ['/expense-create'], element: () => <ExpensesLog /> },
  { path: '/expense-create', perm: 'expenses', element: () => <CreateExpense /> },
  { path: '/wallet', perm: 'wallet', label: 'Sidebar.Wallet', menu: 'main', element: () => <Wallet /> },
  { path: '/users', perm: ADMIN, label: 'Sidebar.Users', menu: 'main', element: () => <Users /> },

  { path: '/daily-report', perm: 'reports', text: 'حركة الصندوق', menu: 'reports', group: 'المالية', also: ['/monthly-report', '/yearly-report'], element: () => <DailyReport period="daily" /> },
  { path: '/monthly-report', perm: 'reports', element: () => <DailyReport period="monthly" /> },
  { path: '/yearly-report', perm: 'reports', element: () => <DailyReport period="yearly" /> },
  { path: '/statement-daily', perm: 'reports', text: 'كشف حساب السائقين', menu: 'reports', group: 'المالية', also: ['/statement-monthly', '/statement-yearly'], element: () => <Statements period="daily" /> },
  { path: '/statement-monthly', perm: 'reports', element: () => <Statements period="monthly" /> },
  { path: '/statement-yearly', perm: 'reports', element: () => <Statements period="yearly" /> },
  { path: '/account-statement', perm: 'wallet', label: 'Sidebar.AccountStatement', menu: 'reports', group: 'المالية', element: () => <AccountStatement /> },
  { path: '/driver-earnings', perm: 'reports', text: 'إيراد السائقين', menu: 'reports', group: 'السائقين', element: () => <DriverEarnings /> },
  { path: '/salaries', perm: 'reports', label: 'Sidebar.Salaries', menu: 'reports', group: 'السائقين', element: () => <Salaries /> },
  { path: '/sms-log', perm: ADMIN, text: 'سجل الرسائل', menu: 'reports', group: 'السجلات', element: () => <SmsLog /> },
  { path: '/audit-log', perm: ADMIN, text: 'سجل التعديلات', menu: 'reports', group: 'السجلات', element: () => <AuditLog /> },
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
  const isActivePage = (p) => isActive(p.path) || (p.also || []).some(isActive);
  // Reports menu entries under their group titles, in PAGES order
  const reportGroups = reportLinks.reduce((groups, p) => {
    const last = groups[groups.length - 1];
    if (last?.title === p.group) last.links.push(p); else groups.push({ title: p.group, links: [p] });
    return groups;
  }, []);
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
            <Link key={p.path} to={p.path} className={`navbar-link ${isActivePage(p) ? 'active' : ''}`}>
              <span className="link-text">{linkText(p)}</span>
            </Link>
          ))}
          {reportLinks.length > 0 && (
            <div className="navbar-dropdown">
              <span className={`navbar-link ${reportLinks.some(isActivePage) ? 'active' : ''}`}>
                <span className="link-text">التقارير ▾</span>
              </span>
              <div className="navbar-dropdown-menu">
                {reportGroups.map(g => (
                  <div key={g.title} className="navbar-dropdown-section">
                    <div className="navbar-dropdown-group">{g.title}</div>
                    {g.links.map(p => (
                      <Link key={p.path} to={p.path} className="navbar-dropdown-item">
                        {linkText(p)}
                      </Link>
                    ))}
                  </div>
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
            {mainLinks.map(p => (
              <Link key={p.path} to={p.path} onClick={closeMenu} className={`mobile-nav-link ${isActivePage(p) ? 'active' : ''}`}>
                {linkText(p)}
              </Link>
            ))}
            {reportGroups.map(g => (
              <div key={g.title}>
                <div className="mobile-nav-group">{g.title}</div>
                {g.links.map(p => (
                  <Link key={p.path} to={p.path} onClick={closeMenu} className={`mobile-nav-link ${isActivePage(p) ? 'active' : ''}`}>
                    {linkText(p)}
                  </Link>
                ))}
              </div>
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
