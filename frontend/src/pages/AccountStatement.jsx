import React, { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';
import PremiumSelect from '../components/PremiumSelect';
import PremiumDatePicker from '../components/PremiumDatePicker';

const AccountStatement = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

    const [customers, setCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerWallet, setCustomerWallet] = useState(null);

    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (selectedCustomerId) {
            fetchCustomerWallet(selectedCustomerId);
        }
    }, [selectedCustomerId]);

    const fetchCustomers = async () => {
        try {
            const res = await api.get('/Customers');
            setCustomers(res.data);
        } catch (err) {
            console.error("Error fetching customers:", err);
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

    const getActiveDateRange = () => {
        let start = startDate ? new Date(startDate) : new Date(2000, 0, 1);
        let end = endDate ? new Date(endDate) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
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

    const getBalanceLabel = (bal) => {
        if (bal > 0) return t('Statements.Customer.Owes');
        if (bal < 0) return t('Statements.Customer.Owed');
        return t('Statements.Customer.Settled');
    };

    const { start, end } = getActiveDateRange();

    // Process wallet transactions
    let sortedTransactions = [];
    let openingBalance = 0;
    let runningBalance = 0;
    let periodTransactions = [];
    let totalDebit = 0;
    let totalCredit = 0;

    if (customerWallet) {
        sortedTransactions = [...customerWallet.transactions].sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate));

        sortedTransactions.forEach(tr => {
            const d = new Date(tr.transactionDate);
            if (d < start) {
                runningBalance += tr.amount;
                openingBalance = runningBalance;
            } else if (d >= start && d <= end) {
                runningBalance += tr.amount;
                periodTransactions.push({ ...tr, currentBalance: runningBalance });
            }
        });

        totalDebit = periodTransactions.filter(tr => tr.amount > 0).reduce((sum, tr) => sum + tr.amount, 0);
        totalCredit = periodTransactions.filter(tr => tr.amount < 0).reduce((sum, tr) => sum + Math.abs(tr.amount), 0);
    }

    return (
        <div className="statements-page">
            <h1 className="page-title no-print">{t('Sidebar.AccountStatement')}</h1>

            {/* Customer Selection & Date Filter */}
            <div className="card no-print" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', background: 'var(--surface-color)' }}>
                <div className="form-group" style={{ margin: 0, minWidth: '280px', flex: 1 }}>
                    <label className="form-label">{t('Statements.Customer.SelectCustomer')}</label>
                    <PremiumSelect
                        options={customers.map(c => ({ value: c.id, label: `${c.name} - ${c.phone}` }))}
                        value={selectedCustomerId}
                        onChange={(val) => setSelectedCustomerId(val)}
                        placeholder={t('Statements.Customer.SelectCustomer')}
                    />
                </div>

                <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                    <label className="form-label">{t('Statements.From')}</label>
                    <input type="date" className="form-control"
                        value={startDate ? startDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                        style={{ textAlign: 'center', fontWeight: '600' }}
                    />
                </div>
                <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                    <label className="form-label">{t('Statements.To')}</label>
                    <input type="date" className="form-control"
                        value={endDate ? endDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                        style={{ textAlign: 'center', fontWeight: '600' }}
                    />
                </div>

                <button className="btn btn-primary" onClick={handlePrint} style={{ marginLeft: 'auto' }}>🖨️ {t('Statements.Print')}</button>
            </div>

            {/* Statement Content */}
            {!selectedCustomerId ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {t('Statements.Customer.SelectCustomer')}
                </div>
            ) : !customerWallet ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>{t('Common.Loading')}</div>
            ) : (
                <div className="statement-content print-area">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="print-only">
                        <h2>{t('Sidebar.AccountStatement')} - {customers.find(c => String(c.id) === String(selectedCustomerId))?.name}</h2>
                        <p>{start.toLocaleDateString(locale)} - {end.toLocaleDateString(locale)}</p>
                    </div>

                    {/* Balance Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                        <div className="card" style={{ background: 'var(--gray-50)', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--gray-200)' }}>
                            <h4 style={{ marginBottom: '8px', color: 'var(--gray-500)' }}>{t('Statements.Customer.OpeningBalance')}</h4>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: openingBalance > 0 ? '#ef4444' : openingBalance < 0 ? '#10b981' : '#718096' }}>
                                <span dir="ltr">{Math.abs(openingBalance)} {t('Dashboard.Currency')}</span> <small style={{ fontSize: '0.85rem' }}>{getBalanceLabel(openingBalance)}</small>
                            </div>
                        </div>
                        <div className="card" style={{ background: 'var(--gray-50)', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--gray-200)' }}>
                            <h4 style={{ marginBottom: '8px', color: 'var(--gray-800)' }}>{t('Statements.Customer.EndingBalance')}</h4>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: runningBalance > 0 ? '#ef4444' : runningBalance < 0 ? '#10b981' : '#718096' }}>
                                <span dir="ltr">{Math.abs(runningBalance)} {t('Dashboard.Currency')}</span> <small style={{ fontSize: '0.9rem' }}>{getBalanceLabel(runningBalance)}</small>
                            </div>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="table-responsive">
                        <table className="data-table bank-statement-table">
                            <thead>
                                <tr>
                                    <th>{t('Statements.Customer.Date')}</th>
                                    <th>{t('Statements.Customer.Description')}</th>
                                    <th style={{ textAlign: 'center' }}>{t('Statements.Customer.Debit')}</th>
                                    <th style={{ textAlign: 'center' }}>{t('Statements.Customer.Credit')}</th>
                                    <th style={{ textAlign: 'center' }}>{t('Statements.Customer.Balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {periodTransactions.map(tr => (
                                    <tr key={tr.id}>
                                        <td>{formatDate(tr.transactionDate)}</td>
                                        <td>{tr.type === 'Trip' ? `${t('Wallet.TripBadge')} #${tr.tripId}` : tr.description}</td>
                                        <td style={{ textAlign: 'center', color: tr.amount > 0 ? '#ef4444' : 'inherit', fontWeight: 'bold' }}>{tr.amount > 0 ? tr.amount : '-'}</td>
                                        <td style={{ textAlign: 'center', color: tr.amount < 0 ? '#10b981' : 'inherit', fontWeight: 'bold' }}>{tr.amount < 0 ? Math.abs(tr.amount) : '-'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }} dir="ltr">
                                            <span style={{ color: tr.currentBalance > 0 ? '#ef4444' : tr.currentBalance < 0 ? '#10b981' : 'inherit' }}>{Math.abs(tr.currentBalance)}</span>
                                            <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: 'var(--gray-500)' }}>{getBalanceLabel(tr.currentBalance)}</span>
                                        </td>
                                    </tr>
                                ))}
                                {periodTransactions.length === 0 && (
                                    <tr><td colSpan="5" style={{ textAlign: 'center' }}>{t('Wallet.Empty')}</td></tr>
                                )}
                                {periodTransactions.length > 0 && (
                                    <tr style={{ background: 'var(--gray-100)', fontWeight: 'bold' }}>
                                        <td colSpan="2">{t('Statements.Customer.Totals')}</td>
                                        <td style={{ textAlign: 'center', color: '#ef4444' }}>{totalDebit}</td>
                                        <td style={{ textAlign: 'center', color: '#10b981' }}>{totalCredit}</td>
                                        <td></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountStatement;
