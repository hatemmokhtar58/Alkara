import React, { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';
import PeriodPicker from '../components/PeriodPicker';
import PageTabs from '../components/PageTabs';
import { usePeriod, periodQuery } from '../components/period';

const CATEGORY_LABELS = { Fuel: 'بنزين', Oil: 'زيت', Wash: 'غسيل', Maintenance: 'صيانة', Other: 'أخرى' };
const COLUMNS = ['baseFare', 'finalTotal', 'cash', 'nonCash', 'fuel', 'debt'];

// Completed trips and expenses for the period, grouped by driver. The server does the math.
const Statements = ({ period = 'daily' }) => {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US';

    const range = usePeriod();
    const query = periodQuery(period, range);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!query) return;
        let cancelled = false;
        setLoading(true);
        api.get(`/Reports/statement?${query}`)
            .then(res => { if (!cancelled) setReport(res.data); })
            .catch(() => { if (!cancelled) setReport(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [query]);

    const fmtTime = (str) => str ? new Date(str).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '-';
    const n = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

    const titles = { daily: 'كشف حساب السائقين - يومي', monthly: 'كشف حساب السائقين - شهري', yearly: 'كشف حساب السائقين - سنوي' };
    const groups = report?.drivers || [];
    const totals = report?.totals;
    const COLS = 10;

    const c = { border: '1px solid var(--border-color)', padding: '8px 12px', textAlign: 'center' };
    const cR = { ...c, textAlign: 'right' };
    const hdr = { background: 'var(--gray-200)', fontWeight: 700 };
    const sub = { background: 'var(--gray-100)', fontWeight: 700 };
    const grd = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800 };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
            <PageTabs tabs={[
                { path: '/statement-daily', label: 'يومي' },
                { path: '/statement-monthly', label: 'شهري' },
                { path: '/statement-yearly', label: 'سنوي' },
            ]} />
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>{titles[period]}</h2>
                <PeriodPicker period={period} value={range}>
                    <button className="btn btn-primary no-print" onClick={() => window.print()} style={{ marginRight: 'auto', marginTop: '14px' }}>طباعة</button>
                </PeriodPicker>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                    <thead>
                        <tr style={hdr}>
                            <th style={c}>#</th>
                            <th style={c}>السائق</th>
                            <th style={c}>الأجرة الأساسية</th>
                            <th style={c}>الإيراد (قيمة المشوار)</th>
                            <th style={c}>مدفوع كاش</th>
                            <th style={c}>مدفوع تحويل / رصيد</th>
                            <th style={c}>بنزين</th>
                            <th style={c}>دين على العميل</th>
                            <th style={c}>الوقت</th>
                            <th style={c}>العميل</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map(group => (
                            <React.Fragment key={group.driverId ?? 'none'}>
                                {group.rows.map((r, i) => r.kind === 'trip' ? (
                                    <tr key={`t-${r.id}`}>
                                        <td style={c}>{i + 1}</td>
                                        <td style={cR}>{group.driverName}</td>
                                        <td style={c}>{n(r.baseFare)}</td>
                                        <td style={c}>{n(r.finalTotal)}</td>
                                        <td style={c}>{n(r.cash)}</td>
                                        <td style={c}>{n(r.nonCash)}</td>
                                        <td style={c}>0</td>
                                        <td style={c}>{n(r.debt)}</td>
                                        <td style={{ ...c, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{fmtTime(r.time)}</td>
                                        <td style={cR}>{r.customerName || '-'}</td>
                                    </tr>
                                ) : (
                                    <tr key={`e-${r.id}`}>
                                        <td style={c}>{i + 1}</td>
                                        <td style={cR}>{group.driverName}</td>
                                        <td style={c}></td>
                                        <td style={c}></td>
                                        <td style={c}></td>
                                        <td style={c}></td>
                                        <td style={{ ...c, color: 'var(--danger-color)' }}>{n(r.fuel)}</td>
                                        <td style={c}></td>
                                        <td style={{ ...c, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{fmtTime(r.time)}</td>
                                        <td style={cR}>{CATEGORY_LABELS[r.category] || r.category}</td>
                                    </tr>
                                ))}
                                <tr style={sub}>
                                    <td style={c}></td>
                                    <td style={{ ...cR, fontWeight: 800 }}>إجمالي السائق</td>
                                    {COLUMNS.map(key => (
                                        <td key={key} style={{ ...c, fontWeight: 700, ...(key === 'fuel' ? { color: 'var(--danger-color)' } : {}) }}>{n(group.totals[key])}</td>
                                    ))}
                                    <td style={c}></td>
                                    <td style={c}></td>
                                </tr>
                            </React.Fragment>
                        ))}
                        {groups.length === 0 && (
                            <tr><td style={{ ...c, padding: '2rem', color: 'var(--gray-400)' }} colSpan={COLS}>{loading ? 'جاري التحميل...' : 'لا توجد بيانات'}</td></tr>
                        )}
                    </tbody>
                    {groups.length > 0 && totals && (
                        <tfoot>
                            <tr style={grd}>
                                <td style={{ ...c, border: 'none' }} colSpan="2">الإجمالي</td>
                                {COLUMNS.map(key => (
                                    <td key={key} style={{ ...c, border: 'none', ...(key === 'fuel' ? { color: '#f87171' } : {}) }}>{n(totals[key])}</td>
                                ))}
                                <td style={{ ...c, border: 'none' }}></td>
                                <td style={{ ...c, border: 'none' }}></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

export default Statements;
