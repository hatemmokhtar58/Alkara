import { useState, useEffect } from 'react';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

const CreateExpense = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [drivers, setDrivers] = useState([]);
    
    const [driverId, setDriverId] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const driversRes = await api.get('/Drivers');
            setDrivers(driversRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Expenses', {
                driverId: parseInt(driverId),
                category: 'Fuel',
                amount: parseFloat(amount),
                note
            });
            setDriverId(''); setAmount(''); setNote('');
            showToast(t('CreateExpense.Success'), 'success');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <h1 className="page-title">{t('CreateExpense.Title')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <form onSubmit={handleAdd} className="modern-form">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">{t('CreateExpense.Driver')}</label>
                            <PremiumSelect 
                                options={drivers.map(d => ({value: d.id, label: d.name}))}
                                value={driverId}
                                onChange={setDriverId}
                                placeholder={t('CreateExpense.SelectDriver')}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateExpense.Category')}</label>
                            <div style={{
                                padding: '0.6rem 1rem', borderRadius: '8px', textAlign: 'center', fontWeight: '700',
                                background: 'var(--warning-bg)', color: 'var(--warning-darker)', border: '1px solid var(--warning-lighter)', fontSize: '1rem'
                            }}>بنزين</div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateExpense.Amount')}</label>
                            <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn btn-large btn-large-blue">{t('CreateExpense.SaveBtn')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateExpense;
