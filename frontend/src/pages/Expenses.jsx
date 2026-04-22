import { useState, useEffect } from 'react';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';

const Expenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [cars, setCars] = useState([]);
    
    // Form
    const [carId, setCarId] = useState('');
    const [type, setType] = useState('Fuel');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [expRes, carRes] = await Promise.all([
                api.get('/Expenses'),
                api.get('/Cars')
            ]);
            setExpenses(expRes.data);
            setCars(carRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Expenses', {
                carId: parseInt(carId),
                type,
                amount: parseFloat(amount),
                description
            });
            setCarId(''); setType('Fuel'); setAmount(''); setDescription('');
            fetchData();
        } catch (err) {
            console.error(err);
            alert(t('Expenses.SaveError'));
        }
    };

    const formatDate = (timeStr) => {
        if (!timeStr) return '-';
        const date = new Date(timeStr);
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getTypeBadge = (type) => {
        switch(type) {
            case 'Fuel': return <span className="badge badge-warning">{t('Expenses.Categories.Fuel')}</span>;
            case 'Maintenance': return <span className="badge" style={{backgroundColor: '#e53e3e', color: 'white'}}>{t('Expenses.Categories.Maintenance')}</span>;
            case 'Washing': return <span className="badge badge-primary">{t('Expenses.Categories.Washing')}</span>;
            case 'Other': return <span className="badge">{t('Expenses.Categories.Other')}</span>;
            default: return <span className="badge">{type}</span>;
        }
    };

    return (
        <div>
            <h1 className="page-title">{t('Expenses.ManageTitle')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 className="card-title">{t('Expenses.AddSubTitle')}</h3>
                <form onSubmit={handleAdd} className="modern-form">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">{t('Expenses.Car')}</label>
                            <PremiumSelect 
                                options={cars.map(c => ({value: c.id, label: `${c.make} ${c.model} - ${c.plateNumber}`}))}
                                value={carId}
                                onChange={setCarId}
                                placeholder={t('Expenses.SelectCarPh')}
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">{t('Expenses.Type')}</label>
                            <PremiumSelect 
                                options={[
                                    {value: 'Fuel', label: t('Expenses.Categories.Fuel')},
                                    {value: 'Maintenance', label: t('Expenses.Categories.Maintenance')},
                                    {value: 'Washing', label: t('Expenses.Categories.Washing')},
                                    {value: 'Other', label: t('Expenses.Categories.Other')}
                                ]}
                                value={type}
                                onChange={setType}
                                placeholder={t('Expenses.SelectTypePh')}
                                required
                                creatable={true}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('Expenses.Amount')}</label>
                            <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('Expenses.Description')}</label>
                            <input type="text" placeholder={t('Expenses.DescriptionPh')} className="form-control" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary btn-large">{t('Expenses.AddBtn')}</button>
                    </div>
                </form>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th>{t('Expenses.Date')}</th>
                        <th>{t('Expenses.CarHeader')}</th>
                        <th>{t('Expenses.TypeHeader')}</th>
                        <th>{t('Expenses.AmountHeader')}</th>
                        <th>{t('Expenses.DescriptionHeader')}</th>
                    </tr>
                </thead>
                <tbody>
                    {expenses.map(exp => (
                        <tr key={exp.id}>
                            <td>{formatDate(exp.date)}</td>
                            <td>{exp.car ? `${exp.car.make} (${exp.car.plateNumber})` : '-'}</td>
                            <td>{getTypeBadge(exp.type)}</td>
                            <td style={{fontWeight: 'bold', color: 'var(--danger-color)'}}>{exp.amount} {t('Dashboard.Currency')}</td>
                            <td>{exp.description}</td>
                        </tr>
                    ))}
                    {expenses.length === 0 && <tr><td colSpan="5" style={{textAlign:'center'}}>{t('Expenses.Empty')}</td></tr>}
                </tbody>
            </table>
        </div>
    );
};

export default Expenses;
