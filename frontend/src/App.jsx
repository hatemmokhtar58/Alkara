import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
import Statements from './pages/Statements';
import Salaries from './pages/Salaries';
import Login from './pages/Login';
import Users from './pages/Users';

import logo from './assets/logo.webp';

import { useToast } from './context/ToastContext';

function App() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [activePath, setActivePath] = useState(window.location.pathname);
  
  useEffect(() => {
    const handleSystemError = (e) => {
      showToast(e.detail, 'error');
    };
    window.addEventListener('system-error', handleSystemError);
    return () => window.removeEventListener('system-error', handleSystemError);
  }, [showToast]);

  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  const [userRole, setUserRole] = useState(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return 'Employee';
    const u = JSON.parse(userStr);
    return u.role || u.Role || 'Employee';
  });
  const [userPermissions, setUserPermissions] = useState(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return [];
    const u = JSON.parse(userStr);
    const p = u.permissions || u.Permissions || '';
    return p ? p.split(',') : [];
  });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const u = JSON.parse(userStr);
      setUserRole(u.role || u.Role || 'Employee');
      const p = u.permissions || u.Permissions || '';
      setUserPermissions(p ? p.split(',') : []);
    } else {
      setUserRole('Employee');
      setUserPermissions([]);
    }
  }, [isAuthenticated]);


  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.body.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebar = () => setIsSidebarOpen(true);

  // userRole and userPermissions are now initialized directly from localStorage above

  const hasPerm = (p) => userPermissions.includes(p) || userRole === 'Admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
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

  const isAdmin = userRole === 'Admin';

  return (
    <Router>
      <div className="app-layout">
        {/* Top Navigation Bar */}
        <nav className="top-navbar">
          <div className="navbar-brand">
            <img src={logo} alt="Alkara" style={{ height: '36px', objectFit: 'contain' }} />
          </div>

          <div className="navbar-links">
            <Link to="/" onClick={() => setActivePath('/')} className={`navbar-link ${activePath === '/' ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.Dashboard')}</span>
            </Link>

            <Link to="/trips-log" onClick={() => setActivePath('/trips-log')} className={`navbar-link ${activePath.includes('/trips-log') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.TripsLog')}</span>
            </Link>
            <Link to="/drivers" onClick={() => setActivePath('/drivers')} className={`navbar-link ${activePath.includes('/drivers') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.Drivers')}</span>
            </Link>
            <Link to="/customers" onClick={() => setActivePath('/customers')} className={`navbar-link ${activePath.includes('/customers') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.Customers')}</span>
            </Link>
            <Link to="/cars" onClick={() => setActivePath('/cars')} className={`navbar-link ${activePath.includes('/cars') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.Cars')}</span>
            </Link>
            <Link to="/expense-create" onClick={() => setActivePath('/expense-create')} className={`navbar-link ${activePath.includes('/expense-create') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.CreateExpense')}</span>
            </Link>
            <Link to="/expenses-log" onClick={() => setActivePath('/expenses-log')} className={`navbar-link ${activePath.includes('/expenses-log') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.ExpensesLog')}</span>
            </Link>
            <Link to="/wallet" onClick={() => setActivePath('/wallet')} className={`navbar-link ${activePath.includes('/wallet') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.Wallet')}</span>
            </Link>
            <Link to="/statements" onClick={() => setActivePath('/statements')} className={`navbar-link ${activePath.includes('/statements') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.Statements')}</span>
            </Link>
            <Link to="/salaries" onClick={() => setActivePath('/salaries')} className={`navbar-link ${activePath.includes('/salaries') ? 'active' : ''}`}>
              <span className="link-text">{t('Sidebar.Salaries')}</span>
            </Link>
            {isAdmin && (
              <Link to="/users" onClick={() => setActivePath('/users')} className={`navbar-link ${activePath.includes('/users') ? 'active' : ''}`}>
                <span className="link-text">{t('Sidebar.Users')}</span>
              </Link>
            )}
          </div>

          <div className="navbar-actions">
            <button onClick={toggleLanguage} className="navbar-lang-btn">
              {i18n.language === 'ar' ? 'EN' : 'AR'}
            </button>
            <button onClick={handleLogout} className="navbar-logout-btn">
              {t('Sidebar.Logout')}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="navbar-hamburger" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            ☰
          </button>
        </nav>

        {/* Mobile dropdown menu */}
        {isSidebarOpen && (
          <>
            <div className="mobile-nav-overlay" onClick={closeSidebar}></div>
            <div className="mobile-nav-dropdown">
              <Link to="/" onClick={() => { setActivePath('/'); closeSidebar(); }} className={`mobile-nav-link ${activePath === '/' ? 'active' : ''}`}>
                {t('Sidebar.Dashboard')}
              </Link>

              <Link to="/trips-log" onClick={() => { setActivePath('/trips-log'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/trips-log') ? 'active' : ''}`}>
                {t('Sidebar.TripsLog')}
              </Link>
              <Link to="/drivers" onClick={() => { setActivePath('/drivers'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/drivers') ? 'active' : ''}`}>
                {t('Sidebar.Drivers')}
              </Link>
              <Link to="/customers" onClick={() => { setActivePath('/customers'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/customers') ? 'active' : ''}`}>
                {t('Sidebar.Customers')}
              </Link>
              <Link to="/cars" onClick={() => { setActivePath('/cars'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/cars') ? 'active' : ''}`}>
                {t('Sidebar.Cars')}
              </Link>
              <Link to="/expense-create" onClick={() => { setActivePath('/expense-create'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/expense-create') ? 'active' : ''}`}>
                {t('Sidebar.CreateExpense')}
              </Link>
              <Link to="/expenses-log" onClick={() => { setActivePath('/expenses-log'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/expenses-log') ? 'active' : ''}`}>
                {t('Sidebar.ExpensesLog')}
              </Link>
              <Link to="/wallet" onClick={() => { setActivePath('/wallet'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/wallet') ? 'active' : ''}`}>
                {t('Sidebar.Wallet')}
              </Link>
              <Link to="/statements" onClick={() => { setActivePath('/statements'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/statements') ? 'active' : ''}`}>
                {t('Sidebar.Statements')}
              </Link>
              <Link to="/salaries" onClick={() => { setActivePath('/salaries'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/salaries') ? 'active' : ''}`}>
                {t('Sidebar.Salaries')}
              </Link>
              {isAdmin && (
                <Link to="/users" onClick={() => { setActivePath('/users'); closeSidebar(); }} className={`mobile-nav-link ${activePath.includes('/users') ? 'active' : ''}`}>
                  {t('Sidebar.Users')}
                </Link>
              )}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { toggleLanguage(); closeSidebar(); }} className="navbar-lang-btn" style={{ flex: 1 }}>
                  {i18n.language === 'ar' ? 'EN' : 'AR'}
                </button>
                <button onClick={() => { handleLogout(); closeSidebar(); }} className="navbar-logout-btn" style={{ flex: 1 }}>
                  {t('Sidebar.Logout')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="main-content navbar-main">
          <Routes>
            <Route path="/" element={<Dashboard userRole={userRole} />} />
            <Route path="/trip-create" element={<CreateTrip userRole={userRole} />} />
            <Route path="/trips-log" element={<TripsLog userRole={userRole} />} />
            <Route path="/drivers" element={<Drivers userRole={userRole} />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/cars" element={<Cars />} />
            <Route path="/expense-create" element={<CreateExpense />} />
            <Route path="/expenses-log" element={<ExpensesLog />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/salaries" element={<Salaries />} />
            <Route path="/users" element={isAdmin ? <Users /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
