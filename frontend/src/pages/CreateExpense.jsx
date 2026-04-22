import { useState, useEffect } from 'react';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

const CreateExpense = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [cars, setCars] = useState([]);
    
    const [carId, setCarId] = useState('');
    const [category, setCategory] = useState('Fuel');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    const [customCategories, setCustomCategories] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [carRes, expRes] = await Promise.all([
                api.get('/Cars'),
                api.get('/Expenses')
            ]);
            setCars(carRes.data);

            // Extract distinct custom types from existing expenses
            const usedTypes = [...new Set(expRes.data.map(e => e.category))];
            const defaultValues = ['Fuel', 'Maintenance', 'OilChange', 'Tires', 'Washing', 'TrafficFines', 'AccidentRepair', 'Other'];
            const newOptions = usedTypes.filter(t => t && !defaultValues.includes(t));
            
            setCustomCategories(newOptions);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Expenses', {
                carId: parseInt(carId),
                category,
                amount: parseFloat(amount),
                note
            });
            setCarId(''); setCategory('Fuel'); setAmount(''); setNote('');
            showToast(t('CreateExpense.Success'), 'success');
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };


    const categoriesOptions = [
        {value: 'Fuel', label: t('Expenses.Fuel')},
        {value: 'Maintenance', label: t('Expenses.Maintenance')},
        {value: 'OilChange', label: t('Expenses.OilChange')},
        {value: 'Tires', label: t('Expenses.Tires')},
        {value: 'Washing', label: t('Expenses.Washing')},
        {value: 'TrafficFines', label: t('Expenses.TrafficFines')},
        {value: 'AccidentRepair', label: t('Expenses.AccidentRepair')},
        {value: 'Other', label: t('Expenses.Other')},
        ...customCategories.map(c => ({value: c, label: c}))
    ];

    return (
        <div>
            <h1 className="page-title">{t('CreateExpense.Title')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <form onSubmit={handleAdd} className="modern-form">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">{t('CreateExpense.Car')}</label>
                            <PremiumSelect 
                                options={cars.map(c => ({value: c.id, label: `${c.make} ${c.model} - ${c.plateNumber}`}))}
                                value={carId}
                                onChange={setCarId}
                                placeholder={t('CreateExpense.SelectCar')}
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">{t('CreateExpense.Category')}</label>
                            <PremiumSelect 
                                options={categoriesOptions}
                                value={category}
                                onChange={setCategory}
                                placeholder={t('CreateExpense.SelectCategory')}
                                required
                                creatable={true}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateExpense.Amount')}</label>
                            <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateExpense.Note')}</label>
                            <input type="text" placeholder={t('CreateExpense.NotePlaceholder')} className="form-control" value={note} onChange={e => setNote(e.target.value)} />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn btn-large btn-large-blue">✨ {t('CreateExpense.SaveBtn')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateExpense;
