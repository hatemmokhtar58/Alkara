import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';

const Dashboard = ({ userRole }) => {
    const { t } = useTranslation();
    const isAdmin = userRole === 'Admin';
    const [stats, setStats] = useState({
        activeTrips: 0,
        availableDrivers: 0,
        todayIncome: 0,
        todayExpenses: 0
    });

    const userStr = localStorage.getItem('user') || '{}';
    const user = JSON.parse(userStr);
    const pStr = user.permissions || user.Permissions || '';
    const userPermissions = pStr ? pStr.split(',') : [];
    const role = userRole || user.role || user.Role || 'Employee';
    const hasFinancePerm = userPermissions.includes('wallet') || userPermissions.includes('reports') || role === 'Admin';


    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch all raw data efficiently
                const [tripsRes, driversRes, expensesRes] = await Promise.all([
                    api.get('/Trips'),
                    api.get('/Drivers'),
                    api.get('/Expenses')
                ]);

                const trips = tripsRes.data;
                const drivers = driversRes.data;
                const expenses = expensesRes.data;

                // 1. Calculate active trips (Scheduled or Ongoing)
                const activeTripsCount = trips.filter(t => t.status === 'Scheduled' || t.status === 'Ongoing').length;
                
                // 2. Calculate available drivers
                const availableDriversCount = drivers.filter(d => d.status === 'Available').length;

                // 3. Calculate today's income
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const todayTrips = trips.filter(t => {
                    if (t.status !== 'Completed' || !t.endTime) return false;
                    const tripDate = new Date(t.endTime);
                    return tripDate >= today;
                });
                const totalIncome = todayTrips.reduce((sum, current) => sum + current.finalTotal, 0);

                // 4. Calculate today's expenses 
                const todayExpensesList = expenses.filter(e => {
                    const expDate = new Date(e.date);
                    return expDate >= today;
                });
                const totalExpenses = todayExpensesList.reduce((sum, current) => sum + current.amount, 0);

                setStats({
                    activeTrips: activeTripsCount,
                    availableDrivers: availableDriversCount,
                    todayIncome: totalIncome,
                    todayExpenses: totalExpenses
                });

            } catch (err) {
                console.error("Error fetching dashboard data", err);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div style={{animation: 'fadeIn 0.5s ease-out'}}>
            <h1 className="page-title">{t('Dashboard.Title')}</h1>
            
            <div className="grid-cards" style={{marginTop: '2rem'}}>
                <div className="card" style={{borderTop: '4px solid var(--secondary-color)', transform: 'translateY(0)'}}>
                    <h3 className="card-title">{t('Dashboard.ActiveTrips')}</h3>
                    <div className="card-value" style={{color: 'var(--secondary-color)', fontSize: '3rem'}}>{stats.activeTrips}</div>
                    <p style={{marginTop: '10px', color: '#718096', fontSize: '0.9rem'}}>{t('Dashboard.ActiveTripsDesc')}</p>
                </div>
                
                <div className="card" style={{borderTop: '4px solid var(--success-color)'}}>
                    <h3 className="card-title">{t('Dashboard.AvailableDrivers')}</h3>
                    <div className="card-value" style={{color: 'var(--success-color)', fontSize: '3rem'}}>{stats.availableDrivers}</div>
                    <p style={{marginTop: '10px', color: '#718096', fontSize: '0.9rem'}}>{t('Dashboard.AvailableDriversDesc')}</p>
                </div>
                
                {hasFinancePerm && (
                    <>
                        <div className="card" style={{borderTop: '4px solid var(--primary-color)'}}>
                            <h3 className="card-title" style={{color: 'var(--primary-color)'}}>{t('Dashboard.TodayIncome')}</h3>
                            <div className="card-value" style={{fontSize: '2.5rem', marginTop:'10px'}}>
                                {stats.todayIncome.toLocaleString()} <span style={{fontSize:'1rem', opacity:0.7}}>{t('Dashboard.Currency')}</span>
                            </div>
                        </div>
                        
                        <div className="card" style={{borderTop: '4px solid var(--danger-color)'}}>
                            <h3 className="card-title" style={{color: 'var(--danger-color)'}}>{t('Dashboard.TodayExpenses')}</h3>
                            <div className="card-value" style={{color: 'var(--danger-color)', fontSize: '2.5rem', marginTop:'10px'}}>
                                {stats.todayExpenses.toLocaleString()} <span style={{fontSize:'1rem', opacity:0.7}}>{t('Dashboard.Currency')}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Net Profit Summary */}
            {hasFinancePerm && (
                <div className="card" style={{marginTop: '2rem', background: 'linear-gradient(135deg, var(--sidebar-bg) 0%, #1e293b 100%)', color: 'white', textAlign: 'center', padding: '2rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}>
                    <h3 style={{opacity: 0.9, marginBottom: '0.5rem', color: '#e2e8f0'}}>{t('Dashboard.NetProfit')}</h3>
                    <div className="dashboard-net-profit-value" style={{fontSize: '4rem', fontWeight: 'bold', color: (stats.todayIncome - stats.todayExpenses) >= 0 ? '#10b981' : '#ef4444'}}>
                        {(stats.todayIncome - stats.todayExpenses).toLocaleString()} <span style={{fontSize:'1.5rem'}}>{t('Dashboard.Currency')}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
