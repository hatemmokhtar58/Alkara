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
      <div className="app-container">
        {/* Mobile Header */}
        <header className="mobile-header">
           <button className="hamburger-btn" onClick={toggleSidebar}>
             ☰
           </button>
           <div className="mobile-logo">
             <img src={logo} alt="Alkara" style={{ height: '40px', objectFit: 'contain' }} />
           </div>
           <button onClick={toggleLanguage} className="mobile-lang-btn">
             {i18n.language === 'ar' ? 'EN' : 'AR'}
           </button>
        </header>

        {/* Sidebar Overlay */}
        {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

        {/* Sidebar */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <img src={logo} alt="Alkara" style={{ height: '50px', objectFit: 'contain', marginBottom: '1rem' }} />
          </div>
          
          <Link to="/" onClick={() => { setActivePath('/'); closeSidebar(); }} className={`nav-link ${activePath === '/' ? 'active' : ''}`}>
            <span className="nav-icon">📊</span> {t('Sidebar.Dashboard')}
          </Link>
          {hasPerm('trips') && (
            <>
              <div style={{ marginTop: '0.5rem', marginBottom: '0.2rem', paddingLeft: '1rem', paddingRight: '1rem', fontSize: '0.8rem', color: 'var(--text-sidebar-muted)', fontWeight: 'bold' }}>{t('Sidebar.Operations')}</div>
              <Link to="/trip-create" onClick={() => { setActivePath('/trip-create'); closeSidebar(); }} className={`nav-link ${activePath.includes('/trip-create') ? 'active' : ''}`}>
                <span className="nav-icon">✨</span> {t('Sidebar.CreateTrip')}
              </Link>
              <Link to="/trips-log" onClick={() => { setActivePath('/trips-log'); closeSidebar(); }} className={`nav-link ${activePath.includes('/trips-log') ? 'active' : ''}`}>
                <span className="nav-icon">📋</span> {t('Sidebar.TripsLog')}
              </Link>
            </>
          )}

          {hasPerm('fleet') && (
            <>
              <div style={{ marginTop: '0.5rem', marginBottom: '0.2rem', paddingLeft: '1rem', paddingRight: '1rem', fontSize: '0.8rem', color: 'var(--text-sidebar-muted)', fontWeight: 'bold' }}>{t('Sidebar.ManagementAndCars')}</div>
              <Link to="/drivers" onClick={() => { setActivePath('/drivers'); closeSidebar(); }} className={`nav-link ${activePath.includes('/drivers') ? 'active' : ''}`}>
                <span className="nav-icon">👲</span> {t('Sidebar.Drivers')}
              </Link>
              <Link to="/customers" onClick={() => { setActivePath('/customers'); closeSidebar(); }} className={`nav-link ${activePath.includes('/customers') ? 'active' : ''}`}>
                <span className="nav-icon">👥</span> {t('Sidebar.Customers')}
              </Link>
              <Link to="/cars" onClick={() => { setActivePath('/cars'); closeSidebar(); }} className={`nav-link ${activePath.includes('/cars') ? 'active' : ''}`}>
                <span className="nav-icon">🚖</span> {t('Sidebar.Cars')}
              </Link>
            </>
          )}
          
          {(hasPerm('expenses') || hasPerm('wallet') || hasPerm('reports')) && (
            <div style={{ marginTop: '0.8rem', marginBottom: '0.2rem', paddingLeft: '1rem', paddingRight: '1rem', fontSize: '0.8rem', color: 'var(--text-sidebar-muted)', fontWeight: 'bold' }}>{t('Sidebar.FinanceAndExpenses')}</div>
          )}
          
          {hasPerm('expenses') && (
            <>
              <Link to="/expense-create" onClick={() => { setActivePath('/expense-create'); closeSidebar(); }} className={`nav-link ${activePath.includes('/expense-create') ? 'active' : ''}`}>
                <span className="nav-icon">💰</span> {t('Sidebar.CreateExpense')}
              </Link>
              <Link to="/expenses-log" onClick={() => { setActivePath('/expenses-log'); closeSidebar(); }} className={`nav-link ${activePath.includes('/expenses-log') ? 'active' : ''}`}>
                <span className="nav-icon">🧾</span> {t('Sidebar.ExpensesLog')}
              </Link>
            </>
          )}

          {hasPerm('wallet') && (
            <Link to="/wallet" onClick={() => { setActivePath('/wallet'); closeSidebar(); }} className={`nav-link ${activePath.includes('/wallet') ? 'active' : ''}`}>
              <span className="nav-icon">💳</span> {t('Sidebar.Wallet')}
            </Link>
          )}

          {hasPerm('reports') && (
            <Link to="/statements" onClick={() => { setActivePath('/statements'); closeSidebar(); }} className={`nav-link ${activePath.includes('/statements') ? 'active' : ''}`}>
              <span className="nav-icon">📈</span> {t('Sidebar.Statements')}
            </Link>
          )}

          {hasPerm('users') && (
            <Link to="/users" onClick={() => { setActivePath('/users'); closeSidebar(); }} className={`nav-link ${activePath.includes('/users') ? 'active' : ''}`} style={{marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '10px'}}>
              <span className="nav-icon">🛡️</span> {t('Sidebar.Users')}
            </Link>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingTop: '1rem', borderTop: '1px solid var(--text-sidebar-muted)' }}>
            <button onClick={toggleLanguage} style={{ width: '100%', padding: '10px', background: 'transparent', color: 'var(--text-sidebar)', border: '1px solid var(--text-sidebar-muted)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
               {t('Sidebar.SwitchLang')}
            </button>
            <button onClick={() => { handleLogout(); closeSidebar(); }} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
               {t('Sidebar.Logout')}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard userRole={userRole} />} />
            <Route path="/trip-create" element={hasPerm('trips') ? <CreateTrip userRole={userRole} /> : <Navigate to="/" />} />
            <Route path="/trips-log" element={hasPerm('trips') ? <TripsLog userRole={userRole} /> : <Navigate to="/" />} />

            <Route path="/drivers" element={hasPerm('fleet') ? <Drivers userRole={userRole} /> : <Navigate to="/" />} />
            <Route path="/customers" element={hasPerm('fleet') ? <Customers /> : <Navigate to="/" />} />
            <Route path="/cars" element={hasPerm('fleet') ? <Cars /> : <Navigate to="/" />} />
            <Route path="/expense-create" element={hasPerm('expenses') ? <CreateExpense /> : <Navigate to="/" />} />
            <Route path="/expenses-log" element={hasPerm('expenses') ? <ExpensesLog /> : <Navigate to="/" />} />
            <Route path="/wallet" element={hasPerm('wallet') ? <Wallet /> : <Navigate to="/" />} />
            <Route path="/statements" element={hasPerm('reports') ? <Statements /> : <Navigate to="/" />} />
            <Route path="/users" element={hasPerm('users') ? <Users /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
