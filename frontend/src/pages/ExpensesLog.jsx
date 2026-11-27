import { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';
import Pager from '../components/Pager';
import PageTabs from '../components/PageTabs';
import { useToast } from '../context/ToastContext';
import { canCorrect } from '../utils/permissions';

const PAGE_SIZE = 50;
const CATEGORY_LABELS = { Fuel: 'بنزين', Oil: 'زيت', Wash: 'غسيل', Maintenance: 'صيانة', Other: 'أخرى' };

const ExpensesLog = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US';
    const [expenses, setExpenses] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [reload, setReload] = useState(0);
    const { showToast } = useToast();
    const allowDelete = canCorrect();

    useEffect(() => {
        api.get(`/Expenses?page=${page}&pageSize=${PAGE_SIZE}`)
            .then(res => { setExpenses(res.data.items); setTotal(res.data.total); })
            .catch(() => {});
    }, [page, reload]);

    const deleteExpense = async (exp) => {
        if (!window.confirm(`هل تريد حذف هذا المصروف (${exp.amount})؟ سيُخصم من حركة الصندوق ويبقى مسجلاً في سجل التعديلات.`)) return;
        try {
            await api.delete(`/Expenses/${exp.id}`);
            showToast('تم حذف المصروف', 'success');
            setReload(r => r + 1);
        } catch {
            // shown by the global error handler
        }
    };

    const formatDate = (timeStr) => {
        if (!timeStr) return '-';
        const date = new Date(timeStr);
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div>
            <PageTabs tabs={[
                { path: '/expense-create', label: 'إضافة مصروف' },
                { path: '/expenses-log', label: 'سجل المصروفات' },
            ]} />
            <h1 className="page-title">{t('ExpensesLog.Title')}</h1>
            
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('ExpensesLog.Date')}</th>
                            <th>{t('ExpensesLog.Driver')}</th>
                            <th>{t('ExpensesLog.Item')}</th>
                            <th>{t('ExpensesLog.Amount')}</th>
                            <th>بواسطة</th>
                            {allowDelete && <th></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map(exp => (
                            <tr key={exp.id}>
                                <td>{formatDate(exp.date)}</td>
                                <td>{exp.driverName || '-'}</td>
                                <td><span className="badge badge-warning">{CATEGORY_LABELS[exp.category] || exp.category}</span></td>
                                <td style={{fontWeight: 'bold', color: 'var(--danger-color)'}}>{exp.amount} {t('Dashboard.Currency')}</td>
                                <td style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>{exp.createdBy || '-'}</td>
                                {allowDelete && <td><button type="button" className="btn btn-danger" style={{ padding: '3px 10px', fontSize: '12px' }} onClick={() => deleteExpense(exp)}>حذف</button></td>}
                            </tr>
                        ))}
                        {expenses.length === 0 && <tr><td colSpan={allowDelete ? 6 : 5} style={{textAlign:'center'}}>{t('ExpensesLog.Empty')}</td></tr>}
                    </tbody>
                </table>
                <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
            </div>
        </div>
    );
};

export default ExpensesLog;
