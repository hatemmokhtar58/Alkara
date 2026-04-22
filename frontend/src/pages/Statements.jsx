import { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';
import PremiumSelect from '../components/PremiumSelect';
import PremiumDatePicker from '../components/PremiumDatePicker';

const Statements = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

    // Global Data State
    const [trips, setTrips] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [customers, setCustomers] = useState([]);

    // UI State
    const [activeTab, setActiveTab] = useState('project'); // project, customers, trips, expenses
    const [dateRangeMode, setDateRangeMode] = useState('ThisMonth');
    const [customStartDate, setCustomStartDate] = useState(null);
    const [customEndDate, setCustomEndDate] = useState(null);

    // Customer Specific State
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerWallet, setCustomerWallet] = useState(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (activeTab === 'customers' && selectedCustomerId) {
            fetchCustomerWallet(selectedCustomerId);
        }
    }, [selectedCustomerId, activeTab]);

    useEffect(() => {
        if (dateRangeMode === 'CustomRange') {
            if (!customStartDate) setCustomStartDate(new Date());
            if (!customEndDate) setCustomEndDate(new Date());
        }
    }, [dateRangeMode]);

    const fetchAllData = async () => {
        try {
            const [tripsRes, expensesRes, customersRes] = await Promise.all([
                api.get('/Trips'),
                api.get('/Expenses'),
                api.get('/Customers')
            ]);
            setTrips(tripsRes.data);
            setExpenses(expensesRes.data);
            setCustomers(customersRes.data);
        } catch (err) {
            console.error("Error fetching data for statements:", err);
        }
    };

    const fetchCustomerWallet = async (id) => {
        try {
            const res = await api.get(`/Wallet/${id}`);
            setCustomerWallet(res.data);
        } catch (err) {
            console.error("Error fetching wallet", err);
            setCustomerWallet(null);
        }
    };

    // Date Logic
    const getActiveDateRange = () => {
        const today = new Date();
        today.setHours(0,0,0,0);
        let start = new Date(today);
        let end = new Date(today);
        end.setHours(23,59,59,999);

        if (dateRangeMode === 'CustomRange') {
            start = customStartDate ? new Date(customStartDate) : new Date(2000, 0, 1);
            end = customEndDate ? new Date(customEndDate) : new Date(today);
            end.setHours(23,59,59,999);
        } else {
            switch(dateRangeMode) {
                case 'Today':
                    break;
                case 'ThisMonth':
                    start.setDate(1);
                    break;
                case 'ThisQuarter':
                    start.setMonth(Math.floor(start.getMonth() / 3) * 3);
                    start.setDate(1);
                    break;
                case 'HalfYear':
                    start.setMonth(Math.floor(start.getMonth() / 6) * 6);
                    start.setDate(1);
                    break;
                case 'ThisYear':
                    start.setMonth(0);
                    start.setDate(1);
                    break;
                case 'All':
                    start = new Date(2000, 0, 1);
                    break;
            }
        }
        return { start, end };
    };

    const filterByDate = (items, dateField) => {
        const { start, end } = getActiveDateRange();
        return items.filter(item => {
            const d = new Date(item[dateField]);
            return d >= start && d <= end;
        });
    };

    const formatDate = (timeStr) => {
        if (!timeStr) return '-';
        return new Date(timeStr).toLocaleString(locale, { 
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const handlePrint = () => {
        window.print();
    };

    // Formatted UI Components
    const renderDateFilter = () => (
        <div className="card no-print" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', background: 'var(--surface-color)' }}>
            <div className="form-group" style={{ margin: 0, minWidth: '300px' }}>
                <label className="form-label">{t('Statements.DateFilter')}</label>
                <PremiumSelect 
                    options={[
                        { value: 'Today', label: t('Statements.Ranges.Today') },
                        { value: 'ThisMonth', label: t('Statements.Ranges.ThisMonth') },
                        { value: 'ThisQuarter', label: t('Statements.Ranges.ThisQuarter') },
                        { value: 'HalfYear', label: t('Statements.Ranges.HalfYear') },
                        { value: 'ThisYear', label: t('Statements.Ranges.ThisYear') },
                        { value: 'All', label: t('Statements.Ranges.All') },
                        { value: 'CustomRange', label: t('Statements.CustomRange') }
                    ]}
                    value={dateRangeMode}
                    onChange={(val) => setDateRangeMode(val)}
                    placeholder={t('Statements.DateFilter')}
                />
            </div>
            
            {dateRangeMode === 'CustomRange' && (
                <>
                    <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                        <label className="form-label">{t('Statements.From')}</label>
                        <PremiumDatePicker 
                            selected={customStartDate} 
                            onChange={(date) => setCustomStartDate(date)}
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                        <label className="form-label">{t('Statements.To')}</label>
                        <PremiumDatePicker 
                            selected={customEndDate} 
                            onChange={(date) => setCustomEndDate(date)}
                        />
                    </div>
                </>
            )}

            <button className="btn btn-primary" onClick={handlePrint} style={{marginLeft: 'auto'}}>🖨️ {t('Statements.Print')}</button>
        </div>
    );

    const renderTabs = () => (
        <div className="tabs-container no-print" style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '10px' }}>
            {['project', 'customers', 'trips', 'expenses'].map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {t(`Statements.Tabs.${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
                </button>
            ))}
        </div>
    );

    const renderProjectStatement = () => {
        const filteredTrips = filterByDate(trips, 'endTime').filter(t => t.status === "Completed");
        const filteredExpenses = filterByDate(expenses, 'date');

        const totalIncome = filteredTrips.reduce((sum, t) => sum + t.finalTotal, 0);
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalIncome - totalExpenses;

        return (
            <div className="statement-content print-area">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="print-only">
                    <h2>{t('Statements.Tabs.Project')}</h2>
                    <p>{getActiveDateRange().start.toLocaleDateString(locale)} - {getActiveDateRange().end.toLocaleDateString(locale)}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '2rem' }}>
                    <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #3b82f6' }}>
                        <h3>{t('Statements.Project.TotalIncome')}</h3>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6', margin: '10px 0' }}>{totalIncome}</p>
                        <small>{t('Dashboard.Currency')}</small>
                    </div>
                    <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #ef4444' }}>
                        <h3>{t('Statements.Project.TotalExpenses')}</h3>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444', margin: '10px 0' }}>{totalExpenses}</p>
                        <small>{t('Dashboard.Currency')}</small>
                    </div>
                    <div className="card" style={{ textAlign: 'center', borderTop: `4px solid ${netProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
                        <h3>{t('Statements.Project.NetProfit')}</h3>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: netProfit >= 0 ? '#10b981' : '#ef4444', margin: '10px 0' }}>{netProfit}</p>
                        <small>{t('Dashboard.Currency')}</small>
                    </div>
                </div>

                <h3>{t('Statements.Project.SummaryDetails')}</h3>
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Statements.Project.Type')}</th>
                                <th>{t('Statements.Project.Count')}</th>
                                <th>{t('Statements.Project.Total')} ({t('Dashboard.Currency')})</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{t('Sidebar.TripsLog')}</td>
                                <td>{filteredTrips.length}</td>
                                <td style={{ color: '#3b82f6', fontWeight: 'bold' }}>{totalIncome}</td>
                            </tr>
                            <tr>
                                <td>{t('Sidebar.ExpensesLog')}</td>
                                <td>{filteredExpenses.length}</td>
                                <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{totalExpenses}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderCustomerStatement = () => {
        if (!selectedCustomerId) {
            return <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>{t('Statements.Customer.SelectCustomer')}</p>;
        }

        if (!customerWallet) return <p>{t('Common.Loading')}</p>;

        const sortedTransactions = [...customerWallet.transactions].sort((a,b) => new Date(a.transactionDate) - new Date(b.transactionDate));
        
        // Calculate Opening Balance and Filter out relevant transactions
        const { start, end } = getActiveDateRange();
        
        let runningBalance = 0; // Starts from 0 historically up to Opening
        let openingBalance = 0;
        
        const periodTransactions = [];
        
        sortedTransactions.forEach(t => {
            const d = new Date(t.transactionDate);
            if (d < start) {
                // Historically before Date Filter
                runningBalance += t.amount;
                openingBalance = runningBalance;
            } else if (d >= start && d <= end) {
                // In period
                runningBalance += t.amount;
                periodTransactions.push({
                    ...t,
                    currentBalance: runningBalance
                });
            }
        });

        const totalDebit = periodTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0); // Cost of trips (Debt added to customer)
        const totalCredit = periodTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0); // Payments (Debt reduced)

        const getBalanceLabel = (bal) => {
            if (bal > 0) return t('Statements.Customer.Owes');
            if (bal < 0) return t('Statements.Customer.Owed');
            return t('Statements.Customer.Settled');
        };

        return (
            <div className="statement-content print-area">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="print-only">
                    <h2>{t('Statements.Tabs.Customers')} - {customers.find(c => String(c.id) === String(selectedCustomerId))?.name}</h2>
                    <p>{start.toLocaleDateString(locale)} - {end.toLocaleDateString(locale)}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div className="card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ marginBottom: '8px', color: '#64748b' }}>{t('Statements.Customer.OpeningBalance')}</h4>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: openingBalance > 0 ? '#ef4444' : openingBalance < 0 ? '#10b981' : '#718096' }}>
                            <span dir="ltr">{Math.abs(openingBalance)} {t('Dashboard.Currency')}</span> <small style={{fontSize: '0.85rem'}}>{getBalanceLabel(openingBalance)}</small>
                        </div>
                    </div>
                    <div className="card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ marginBottom: '8px', color: '#1e293b' }}>{t('Statements.Customer.EndingBalance')}</h4>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: runningBalance > 0 ? '#ef4444' : runningBalance < 0 ? '#10b981' : '#718096' }}>
                            <span dir="ltr">{Math.abs(runningBalance)} {t('Dashboard.Currency')}</span> <small style={{fontSize: '0.9rem'}}>{getBalanceLabel(runningBalance)}</small>
                        </div>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="data-table bank-statement-table">
                        <thead>
                            <tr>
                                <th>{t('Statements.Customer.Date')}</th>
                                <th>{t('Statements.Customer.Description')}</th>
                                <th style={{textAlign: 'center'}}>{t('Statements.Customer.Debit')}</th>
                                <th style={{textAlign: 'center'}}>{t('Statements.Customer.Credit')}</th>
                                <th style={{textAlign: 'center'}}>{t('Statements.Customer.Balance')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {periodTransactions.map(tr => (
                                <tr key={tr.id}>
                                    <td>{formatDate(tr.transactionDate)}</td>
                                    <td>{tr.type === 'Trip' ? `${t('Wallet.TripBadge')} #${tr.tripId}` : tr.description}</td>
                                    <td style={{textAlign: 'center', color: tr.amount > 0 ? '#ef4444' : 'inherit', fontWeight: 'bold'}}>{tr.amount > 0 ? tr.amount : '-'}</td>
                                    <td style={{textAlign: 'center', color: tr.amount < 0 ? '#10b981' : 'inherit', fontWeight: 'bold'}}>{tr.amount < 0 ? Math.abs(tr.amount) : '-'}</td>
                                    <td style={{textAlign: 'center', fontWeight: 'bold'}} dir="ltr">
                                        <span style={{color: tr.currentBalance > 0 ? '#ef4444' : tr.currentBalance < 0 ? '#10b981' : 'inherit'}}>{Math.abs(tr.currentBalance)}</span>
                                        <span style={{fontSize: '0.8rem', marginLeft: '6px', color: '#64748b'}}>{getBalanceLabel(tr.currentBalance)}</span>
                                    </td>
                                </tr>
                            ))}
                            {periodTransactions.length === 0 && (
                                <tr><td colSpan="5" style={{textAlign: 'center'}}>{t('Wallet.Empty')}</td></tr>
                            )}
                            {/* Totals Row */}
                            {periodTransactions.length > 0 && (
                                <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                                    <td colSpan="2">{t('Statements.Customer.Totals')}</td>
                                    <td style={{textAlign: 'center', color: '#ef4444'}}>{totalDebit}</td>
                                    <td style={{textAlign: 'center', color: '#10b981'}}>{totalCredit}</td>
                                    <td></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderTripsStatement = () => {
        const filteredTrips = filterByDate(trips, 'endTime').filter(t => t.status === "Completed");
        const total = filteredTrips.reduce((sum, t) => sum + t.finalTotal, 0);

        return (
            <div className="statement-content print-area">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="print-only">
                    <h2>{t('Statements.Tabs.Trips')}</h2>
                    <p>{getActiveDateRange().start.toLocaleDateString(locale)} - {getActiveDateRange().end.toLocaleDateString(locale)}</p>
                </div>
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Statements.Trips.TripId')}</th>
                                <th>{t('Statements.Trips.Customer')}</th>
                                <th>{t('Statements.Trips.Driver')}</th>
                                <th>{t('Statements.Trips.Car')}</th>
                                <th>{t('Statements.Trips.EndDate')}</th>
                                <th>{t('Statements.Trips.TotalPayment')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTrips.map(tr => (
                                <tr key={tr.id}>
                                    <td>#{tr.id}</td>
                                    <td>{tr.customer?.name}</td>
                                    <td>{tr.driver?.name}</td>
                                    <td>{tr.car?.plateNumber}</td>
                                    <td>{formatDate(tr.endTime)}</td>
                                    <td style={{fontWeight: 'bold', color: 'var(--success-color)'}}>{tr.finalTotal} {t('Dashboard.Currency')}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan="5" style={{fontWeight: 'bold', textAlign: 'end'}}>{t('Statements.Trips.GrandTotal')}</td>
                                <td style={{fontWeight: 'bold', color: 'var(--primary-color)'}}>{total} {t('Dashboard.Currency')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    const renderExpensesStatement = () => {
        const filteredExpenses = filterByDate(expenses, 'date');
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

        return (
            <div className="statement-content print-area">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="print-only">
                    <h2>{t('Statements.Tabs.Expenses')}</h2>
                    <p>{getActiveDateRange().start.toLocaleDateString(locale)} - {getActiveDateRange().end.toLocaleDateString(locale)}</p>
                </div>
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Statements.Expenses.RefId')}</th>
                                <th>{t('Statements.Expenses.Category')}</th>
                                <th>{t('Statements.Expenses.Car')}</th>
                                <th>{t('Statements.Expenses.Date')}</th>
                                <th>{t('Statements.Expenses.Amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map(exp => (
                                <tr key={exp.id}>
                                    <td>#{exp.id}</td>
                                    <td>{t(`Expenses.${exp.category}`) || exp.category}</td>
                                    <td>{exp.car ? exp.car.plateNumber : '-'}</td>
                                    <td>{formatDate(exp.date)}</td>
                                    <td style={{fontWeight: 'bold', color: 'var(--danger-color)'}}>{exp.amount} {t('Dashboard.Currency')}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan="4" style={{fontWeight: 'bold', textAlign: 'end'}}>{t('Statements.Expenses.GrandTotal')}</td>
                                <td style={{fontWeight: 'bold', color: 'var(--danger-color)'}}>{total} {t('Dashboard.Currency')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="statements-page">
            <h1 className="page-title no-print">{t('Statements.Title')}</h1>
            
            {renderDateFilter()}
            {renderTabs()}

            {activeTab === 'customers' && (
                <div className="card no-print" style={{ marginBottom: '1.5rem', background: 'var(--surface-color)' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">{t('Statements.Customer.SelectCustomer')}</label>
                        <PremiumSelect 
                            options={customers.map(c => ({value: c.id, label: `${c.name} - ${c.phone}`}))}
                            value={selectedCustomerId}
                            onChange={(val) => setSelectedCustomerId(val)}
                            placeholder={t('Statements.Customer.SelectCustomer')}
                        />
                    </div>
                </div>
            )}

            <div className="statements-body bg-white rounded-xl shadow-sm p-4">
                {activeTab === 'project' && renderProjectStatement()}
                {activeTab === 'customers' && renderCustomerStatement()}
                {activeTab === 'trips' && renderTripsStatement()}
                {activeTab === 'expenses' && renderExpensesStatement()}
            </div>
        </div>
    );
};

export default Statements;
