import { useState, useEffect } from 'react';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

const Wallet = () => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [walletData, setWalletData] = useState({ balance: 0, transactions: [] });
    
    // Deposit Form
    const [depositAmount, setDepositAmount] = useState('');
    const [depositNote, setDepositNote] = useState('');

    useEffect(() => {
        api.get('/Customers').then(res => setCustomers(res.data)).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            fetchWalletInfo();
        } else {
            setWalletData({ balance: 0, transactions: [] });
        }
    }, [selectedCustomer]);

    const fetchWalletInfo = () => {
        api.get(`/Wallet/${selectedCustomer}`)
            .then(res => setWalletData(res.data))
            .catch(console.error);
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Wallet/Deposit', {
                customerId: parseInt(selectedCustomer),
                amount: parseFloat(depositAmount),
                note: depositNote
            });
            showToast(t('Common.Success'), 'success');
            setDepositAmount('');
            setDepositNote('');
            fetchWalletInfo();
        } catch (err) {
            console.error(err);
        }
    };


    const formatDate = (timeStr) => {
        if (!timeStr) return '-';
        const date = new Date(timeStr);
        return date.toLocaleTimeString(locale, { timeZone: 'Asia/Riyadh', hour: '2-digit', minute:'2-digit' }) + ' ' + date.toLocaleDateString(locale, { timeZone: 'Asia/Riyadh' });
    };

    return (
        <div>
            <h1 className="page-title">{t('Wallet.Title')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 className="card-title">{t('Wallet.SelectCustomer')}</h3>
                <div className="form-group" style={{ maxWidth: '400px' }}>
                    <PremiumSelect 
                        options={customers.map(c => ({value: c.id, label: `${c.name} (${c.phone})`}))}
                        value={selectedCustomer}
                        onChange={setSelectedCustomer}
                        placeholder={t('Wallet.SelectCustomerPh')}
                    />
                </div>
            </div>

            {selectedCustomer && (
                <>
                    <div className="card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-gradient)', color: 'white' }}>
                        <div>
                            <h3 style={{ marginBottom: '0.5rem', opacity: 0.9 }}>{t('Wallet.Balance')}</h3>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: walletData.balance > 0 ? '#ffcccc' : (walletData.balance < 0 ? '#ccffcc' : 'white') }}>
                                {(walletData.balance * -1)} <span style={{fontSize: '1rem'}}>{t('Dashboard.Currency')}</span>
                            </div>
                        </div>
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', color: 'black', width: '350px' }}>
                            <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{t('Wallet.DepositTitle')}</h4>
                            <form onSubmit={handleDeposit}>
                                <div className="form-group">
                                    <input type="number" step="0.01" placeholder={t('Wallet.Amount')} className="form-control" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>{t('Wallet.NoteLabel')}</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button type="button" onClick={() => setDepositNote(t('Wallet.NoteCashDriver'))}
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem',
                                                fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.2s',
                                                background: depositNote === t('Wallet.NoteCashDriver') ? 'var(--primary-color)' : 'var(--gray-100)',
                                                color: depositNote === t('Wallet.NoteCashDriver') ? 'white' : 'var(--gray-700)',
                                                border: `2px solid ${depositNote === t('Wallet.NoteCashDriver') ? 'var(--primary-color)' : 'var(--gray-200)'}`
                                            }}>
                                            💰 {t('Wallet.NoteCashDriver')}
                                        </button>
                                        <button type="button" onClick={() => setDepositNote(t('Wallet.NoteTransferAdmin'))}
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem',
                                                fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.2s',
                                                background: depositNote === t('Wallet.NoteTransferAdmin') ? 'var(--primary-color)' : 'var(--gray-100)',
                                                color: depositNote === t('Wallet.NoteTransferAdmin') ? 'white' : 'var(--gray-700)',
                                                border: `2px solid ${depositNote === t('Wallet.NoteTransferAdmin') ? 'var(--primary-color)' : 'var(--gray-200)'}`
                                            }}>
                                            🏦 {t('Wallet.NoteTransferAdmin')}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{width: '100%', padding: '0.8rem'}}>{t('Wallet.DepositBtn')}</button>
                            </form>
                        </div>
                    </div>

                    <h3 className="page-title" style={{fontSize: '1.3rem'}}>{t('Wallet.LogTitle')}</h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Wallet.CustomerName')}</th>
                                <th>{t('Wallet.Date')}</th>
                                <th>{t('Wallet.Type')}</th>
                                <th>{t('Wallet.Amount')}</th>
                                <th>{t('Wallet.Details')}</th>
                                <th>{t('Wallet.TripId')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {walletData.transactions.map(tData => {
                                const displayedAmount = tData.amount * -1;
                                const customerObj = customers.find(c => c.id === parseInt(selectedCustomer));
                                return (
                                    <tr key={tData.id}>
                                        <td><span className="badge" style={{background: 'var(--gray-200)', color: 'var(--gray-800)'}}>{customerObj ? customerObj.name : '-'}</span></td>
                                        <td>{formatDate(tData.transactionDate)}</td>
                                        <td>
                                            {(tData.type === 'CashDeposit' || tData.type === 'CashCollection') ? <span className="badge badge-success">{t('Wallet.DepositBadge')}</span> : <span className="badge badge-warning">{t('Wallet.TripBadge')}</span>}
                                        </td>
                                        <td style={{fontWeight: 'bold', color: displayedAmount > 0 ? 'var(--success-color)' : (displayedAmount < 0 ? 'var(--danger-color)' : 'inherit')}}>
                                            {displayedAmount > 0 ? `+${displayedAmount}` : displayedAmount} {t('Dashboard.Currency')}
                                        </td>
                                        <td>{tData.description}</td>
                                        <td>{tData.tripId ? `#${tData.tripId}` : '-'}</td>
                                    </tr>
                                );
                            })}
                            {walletData.transactions.length === 0 && <tr><td colSpan="6" style={{textAlign:'center'}}>{t('Wallet.Empty')}</td></tr>}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
};

export default Wallet;
