import { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';

const ExpensesLog = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const expRes = await api.get('/Expenses');
            setExpenses(expRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const formatDate = (timeStr) => {
        if (!timeStr) return '-';
        const date = new Date(timeStr);
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getTypeBadge = (category) => {
        switch(category) {
            case 'Fuel': return <span className="badge badge-warning">{t('Expenses.Fuel')}</span>;
            case 'Maintenance': return <span className="badge" style={{backgroundColor: '#e53e3e', color: 'white'}}>{t('Expenses.Maintenance')}</span>;
            case 'OilChange': return <span className="badge" style={{backgroundColor: '#f6ad55', color: 'white'}}>{t('Expenses.OilChange')}</span>;
            case 'Tires': return <span className="badge" style={{backgroundColor: '#4a5568', color: 'white'}}>{t('Expenses.Tires')}</span>;
            case 'Washing': return <span className="badge badge-primary">{t('Expenses.Washing')}</span>;
            case 'TrafficFines': return <span className="badge badge-danger">{t('Expenses.TrafficFines')}</span>;
            case 'AccidentRepair': return <span className="badge" style={{backgroundColor: '#718096', color: 'white'}}>{t('Expenses.AccidentRepair')}</span>;
            case 'Other': return <span className="badge">{t('Expenses.Other')}</span>;
            default: return <span className="badge">{category}</span>;
        }
    };

    return (
        <div>
            <h1 className="page-title">{t('ExpensesLog.Title')}</h1>
            
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('ExpensesLog.Date')}</th>
                            <th>{t('ExpensesLog.Car')}</th>
                            <th>{t('ExpensesLog.Item')}</th>
                            <th>{t('ExpensesLog.Amount')}</th>
                            <th>{t('ExpensesLog.Note')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map(exp => (
                            <tr key={exp.id}>
                                <td>{formatDate(exp.date)}</td>
                                <td>{exp.car ? `${exp.car.make} (${exp.car.plateNumber})` : '-'}</td>
                                <td>{getTypeBadge(exp.category)}</td>
                                <td style={{fontWeight: 'bold', color: 'var(--danger-color)'}}>{exp.amount} {t('Dashboard.Currency')}</td>
                                <td>{exp.note}</td>
                            </tr>
                        ))}
                        {expenses.length === 0 && <tr><td colSpan="5" style={{textAlign:'center'}}>{t('ExpensesLog.Empty')}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ExpensesLog;
