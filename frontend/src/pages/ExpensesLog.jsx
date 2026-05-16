import { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';

const ExpensesLog = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const [expenses, setExpenses] = useState([]);
    const [drivers, setDrivers] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [expRes, drvRes] = await Promise.all([
                api.get('/Expenses'),
                api.get('/Drivers')
            ]);
            setExpenses(expRes.data);
            setDrivers(drvRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const formatDate = (timeStr) => {
        if (!timeStr) return '-';
        const date = new Date(timeStr);
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getDriverName = (driverId) => {
        const drv = drivers.find(d => d.id === driverId);
        return drv ? drv.name : '-';
    };

    return (
        <div>
            <h1 className="page-title">{t('ExpensesLog.Title')}</h1>
            
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('ExpensesLog.Date')}</th>
                            <th>{t('ExpensesLog.Driver')}</th>
                            <th>{t('ExpensesLog.Item')}</th>
                            <th>{t('ExpensesLog.Amount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map(exp => (
                            <tr key={exp.id}>
                                <td>{formatDate(exp.date)}</td>
                                <td>{getDriverName(exp.driverId)}</td>
                                <td><span className="badge badge-warning">بنزين</span></td>
                                <td style={{fontWeight: 'bold', color: 'var(--danger-color)'}}>{exp.amount} {t('Dashboard.Currency')}</td>
                            </tr>
                        ))}
                        {expenses.length === 0 && <tr><td colSpan="4" style={{textAlign:'center'}}>{t('ExpensesLog.Empty')}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ExpensesLog;
