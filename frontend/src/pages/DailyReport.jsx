import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import PeriodPicker from '../components/PeriodPicker';
import { usePeriod, periodQuery } from '../components/period';

// Cash box movement for the period: cash trips, collections and deposits in, expenses out. The server does the math.
export default function DailyReport({ period = 'daily' }) {
    const { t } = useTranslation();
    const currency = t('Dashboard.Currency');

    const range = usePeriod();
    const query = periodQuery(period, range);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!query) return;
        let cancelled = false;
        setLoading(true);
        api.get(`/Reports/cashbox?${query}`)
            .then(res => { if (!cancelled) setReport(res.data); })
            .catch(() => { if (!cancelled) setReport(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [query]);

    const titles = { daily: 'حركة الصندوق - يومي', monthly: 'حركة الصندوق - شهري', yearly: 'حركة الصندوق - سنوي' };
    const netLabels = { daily: 'صافي اليوم', monthly: 'صافي الشهر', yearly: 'صافي السنة' };
    const money = (v) => Number(v || 0).toFixed(2);

    const tbl = { width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', fontSize: '1rem' };
    const cell = { border: '1px solid var(--border-color)', padding: '10px 14px', textAlign: 'center' };
    const cellR = { ...cell, textAlign: 'right' };
    const headerRow = { background: 'var(--gray-200)', fontWeight: 700 };
    const totalRow = { background: 'var(--gray-100)', fontWeight: 700 };
    const balanceRow = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800, fontSize: '1.1rem' };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>{titles[period]}</h2>
                <PeriodPicker period={period} value={range}>
                    <button className="btn btn-primary no-print" onClick={() => window.print()} style={{ marginRight: 'auto', marginTop: '14px' }}>طباعة</button>
                </PeriodPicker>
            </div>

            {loading && !report ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>جاري التحميل...</div>
            ) : !report ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>تعذر تحميل التقرير.</div>
            ) : (
                <table style={tbl}>
                    <thead>
                        <tr style={headerRow}>
                            <th style={cell}>#</th>
                            <th style={cell}>البيان</th>
                            <th style={cell}>الاسم</th>
                            <th style={cell}>مدين (قبض)</th>
                            <th style={cell}>دائن (صرف)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 1. Cash trips per driver */}
                        {report.trips.map((row, i) => (
                            <tr key={`drv-${row.driverId ?? 'none'}`}>
                                <td style={cell}>{i + 1}</td>
                                <td style={cellR}>مشاوير {row.driverName} ({row.count})</td>
                                <td style={cellR}>{row.driverName}</td>
                                <td style={{ ...cell, fontWeight: 600 }}>{money(row.total)}</td>
                                <td style={cell}>-</td>
                            </tr>
                        ))}
                        <tr style={totalRow}>
                            <td style={cell} colSpan="3">اجمالي المشاوير</td>
                            <td style={{ ...cell, fontWeight: 700 }}>{money(report.totalTrips)}</td>
                            <td style={cell}>-</td>
                        </tr>

                        {/* 2. Collections and deposits */}
                        {report.collections.map((tx, i) => (
                            <tr key={`col-${tx.id}`}>
                                <td style={cell}>{i + 1}</td>
                                <td style={cellR}>{tx.type === 'CashCollection' ? 'تحصيل / كاش' : 'تحصيل / ادارة'}</td>
                                <td style={cellR}>{tx.customerName || '-'}</td>
                                <td style={{ ...cell, fontWeight: 600 }}>{money(tx.amount)}</td>
                                <td style={cell}>-</td>
                            </tr>
                        ))}
                        <tr style={totalRow}>
                            <td style={cell} colSpan="3">اجمالي التحصيل</td>
                            <td style={{ ...cell, fontWeight: 700 }}>{money(report.totalCollections)}</td>
                            <td style={cell}>-</td>
                        </tr>

                        {/* 3. Expenses per driver */}
                        {report.expenses.map((row, i) => (
                            <tr key={`exp-${row.driverId ?? 'none'}`}>
                                <td style={cell}>{i + 1}</td>
                                <td style={cellR}>مصروفات {row.driverName} ({row.count})</td>
                                <td style={cellR}>{row.driverName}</td>
                                <td style={cell}>-</td>
                                <td style={{ ...cell, fontWeight: 600, color: 'var(--danger-color)' }}>{money(row.total)}</td>
                            </tr>
                        ))}
                        <tr style={totalRow}>
                            <td style={cell} colSpan="3">اجمالي المصروفات</td>
                            <td style={cell}>-</td>
                            <td style={{ ...cell, fontWeight: 700, color: 'var(--danger-color)' }}>{money(report.totalExpenses)}</td>
                        </tr>

                        {/* 4. Net */}
                        <tr style={balanceRow}>
                            <td style={{ ...cell, border: 'none' }} colSpan="3">{netLabels[period]}</td>
                            <td style={{ ...cell, border: 'none', fontSize: '1.1rem' }} colSpan="2">{money(report.net)} {currency}</td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
}
