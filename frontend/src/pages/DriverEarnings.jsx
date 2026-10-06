import React, { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';
import PeriodPicker from '../components/PeriodPicker';
import { usePeriod, periodQuery } from '../components/period';
import { SOURCE_LABELS } from '../components/paymentSources';


// Customer money received in the month, matched to the oldest unpaid trips first, per driver.
// Commission is paid on this money only, in the month it was received. The server does the math.
const DriverEarnings = () => {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US';

    const range = usePeriod();
    const query = periodQuery('monthly', range);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState({});

    useEffect(() => {
        if (!query) return;
        let cancelled = false;
        setLoading(true);
        api.get(`/Reports/driver-earnings?${query}`)
            .then(res => { if (!cancelled) setReport(res.data); })
            .catch(() => { if (!cancelled) setReport(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [query]);

    const fmtDate = (str) => str ? new Date(str).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '-';
    const n = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

    const drivers = report?.drivers || [];
    const totals = report?.totals;
    const COLS = 8;

    const c = { border: '1px solid var(--border-color)', padding: '8px 12px', textAlign: 'center' };
    const cR = { ...c, textAlign: 'right' };
    const hdr = { background: 'var(--gray-200)', fontWeight: 700 };
    const sub = { background: 'var(--gray-100)', fontSize: '0.85rem' };
    const grd = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800 };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>إيراد السائقين</h2>
                <p style={{ color: 'var(--gray-500)', margin: '0 0 0.75rem' }}>
                    الفلوس الي دخلت من العملاء في الشهر، موزعة على أقدم المشاوير غير المدفوعة أولاً. العمولة على المحصّل بس.
                </p>
                <PeriodPicker period="monthly" value={range}>
                    <button className="btn btn-primary no-print" onClick={() => window.print()} style={{ marginRight: 'auto', marginTop: '14px' }}>طباعة</button>
                </PeriodPicker>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                    <thead>
                        <tr style={hdr}>
                            <th style={c}>السائق</th>
                            <th style={c}>عدد المشاوير</th>
                            <th style={c}>قيمة المشاوير</th>
                            <th style={c}>المحصّل</th>
                            <th style={c}>بنزين</th>
                            <th style={c}>النسبة</th>
                            <th style={c}>العمولة</th>
                            <th style={c}>متبقي على العملاء</th>
                        </tr>
                    </thead>
                    <tbody>
                        {drivers.map(d => (
                            <React.Fragment key={d.driverId}>
                                <tr style={{ cursor: d.payments.length ? 'pointer' : 'default' }}
                                    onClick={() => setOpen(o => ({ ...o, [d.driverId]: !o[d.driverId] }))}>
                                    <td style={{ ...cR, fontWeight: 700 }}>
                                        {d.payments.length > 0 && <span className="no-print">{open[d.driverId] ? '▾ ' : '◂ '}</span>}
                                        {d.driverName}
                                    </td>
                                    <td style={c}>{d.tripsCount}</td>
                                    <td style={c}>{n(d.tripsValue)}</td>
                                    <td style={{ ...c, fontWeight: 700, color: 'var(--success-color)' }}>{n(d.collected)}</td>
                                    <td style={{ ...c, color: 'var(--danger-color)' }}>{n(d.fuel)}</td>
                                    <td style={c}>{n(d.commissionPercent)}%</td>
                                    <td style={{ ...c, fontWeight: 700 }}>{n(d.commission)}</td>
                                    <td style={c}>{n(d.outstanding)}</td>
                                </tr>
                                {open[d.driverId] && d.payments.map((p, i) => (
                                    <tr key={`${d.driverId}-${i}`} style={sub}>
                                        <td style={cR}>{p.customerName || '-'}</td>
                                        <td style={c} colSpan="2">مشوار {fmtDate(p.tripDate)}</td>
                                        <td style={c}>{n(p.amount)}</td>
                                        <td style={c} colSpan="2">{SOURCE_LABELS[p.source] || p.source}</td>
                                        <td style={c} colSpan="2">وصل {fmtDate(p.collectedAt)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {drivers.length === 0 && (
                            <tr><td style={{ ...c, padding: '2rem', color: 'var(--gray-400)' }} colSpan={COLS}>{loading ? 'جاري التحميل...' : 'لا توجد بيانات'}</td></tr>
                        )}
                    </tbody>
                    {drivers.length > 0 && totals && (
                        <tfoot>
                            <tr style={grd}>
                                <td style={{ ...c, border: 'none' }} colSpan="2">الإجمالي</td>
                                <td style={{ ...c, border: 'none' }}>{n(totals.tripsValue)}</td>
                                <td style={{ ...c, border: 'none' }}>{n(totals.collected)}</td>
                                <td style={{ ...c, border: 'none', color: '#f87171' }}>{n(totals.fuel)}</td>
                                <td style={{ ...c, border: 'none' }}></td>
                                <td style={{ ...c, border: 'none' }}>{n(totals.commission)}</td>
                                <td style={{ ...c, border: 'none' }}>{n(totals.outstanding)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

export default DriverEarnings;
