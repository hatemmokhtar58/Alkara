import { useState, useEffect } from 'react';
import api from '../api';
import PeriodPicker from '../components/PeriodPicker';
import PageTabs from '../components/PageTabs';
import { usePeriod, periodQuery } from '../components/period';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// Revenue - expenses - drivers' salaries, per month. The server does the math.
export default function Profit({ period = 'monthly' }) {
    const range = usePeriod();
    const query = periodQuery(period, range);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!query) return;
        let cancelled = false;
        setLoading(true);
        api.get(`/Reports/profit?${query}`)
            .then(res => { if (!cancelled) setReport(res.data); })
            .catch(() => { if (!cancelled) setReport(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [query]);

    const n = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const titles = { monthly: 'صافي الربح - شهري', yearly: 'صافي الربح - سنوي' };
    const months = report?.months || [];
    const totals = report?.totals;

    const c = { border: '1px solid var(--border-color)', padding: '10px 14px', textAlign: 'center' };
    const hdr = { background: 'var(--gray-200)', fontWeight: 700 };
    const grd = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800 };
    const netStyle = (v) => ({ ...c, fontWeight: 700, color: v < 0 ? 'var(--danger-color)' : 'var(--success-color)' });

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
            <PageTabs tabs={[
                { path: '/profit-monthly', label: 'شهري' },
                { path: '/profit-yearly', label: 'سنوي' },
            ]} />
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>{titles[period]}</h2>
                <PeriodPicker period={period} value={range}>
                    <button className="btn btn-primary no-print" onClick={() => window.print()} style={{ marginRight: 'auto', marginTop: '14px' }}>طباعة</button>
                </PeriodPicker>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '8px' }}>
                    صافي الربح = الإيراد (قيمة المشاوير المنتهية) − المصروفات − رواتب السائقين. الرواتب التي لم تُصرف بعد تُحسب بقيمتها الحالية وتظهر بعلامة «تقديري». السلفة تدخل في التكاليف إذا سُجّلت مصروفاً عند صرفها.
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                <thead>
                    <tr style={hdr}>
                        <th style={c}>الشهر</th>
                        <th style={c}>الإيراد</th>
                        <th style={c}>المصروفات</th>
                        <th style={c}>الرواتب</th>
                        <th style={c}>صافي الربح</th>
                    </tr>
                </thead>
                <tbody>
                    {months.map(m => (
                        <tr key={`${m.year}-${m.month}`}>
                            <td style={c}>{MONTHS[m.month - 1]} {m.year}</td>
                            <td style={c}>{n(m.revenue)}</td>
                            <td style={{ ...c, color: 'var(--danger-color)' }}>{n(m.expenses)}</td>
                            <td style={{ ...c, color: 'var(--danger-color)' }}>
                                {n(m.salaries)}
                                {!m.salariesFinal && <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}> (تقديري)</span>}
                            </td>
                            <td style={netStyle(m.net)}>{n(m.net)}</td>
                        </tr>
                    ))}
                    {months.length === 0 && (
                        <tr><td style={{ ...c, padding: '2rem', color: 'var(--gray-400)' }} colSpan="5">{loading ? 'جاري التحميل...' : 'لا توجد بيانات'}</td></tr>
                    )}
                </tbody>
                {months.length > 1 && totals && (
                    <tfoot>
                        <tr style={grd}>
                            <td style={{ ...c, border: 'none' }}>الإجمالي</td>
                            <td style={{ ...c, border: 'none' }}>{n(totals.revenue)}</td>
                            <td style={{ ...c, border: 'none' }}>{n(totals.expenses)}</td>
                            <td style={{ ...c, border: 'none' }}>{n(totals.salaries)}</td>
                            <td style={{ ...c, border: 'none' }}>{n(totals.net)}</td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}
