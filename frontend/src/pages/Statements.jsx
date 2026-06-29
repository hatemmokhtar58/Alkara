import React, { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';

const Statements = ({ period = 'daily' }) => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const currency = t('Dashboard.Currency');

    const [trips, setTrips] = useState([]);
    const [expenses, setExpenses] = useState([]);

    const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

    useEffect(() => { fetchAllData(); }, []);

    const fetchAllData = async () => {
        try {
            const [tripsRes, expensesRes] = await Promise.all([
                api.get('/Trips'),
                api.get('/Expenses')
            ]);
            setTrips(tripsRes.data);
            setExpenses(expensesRes.data);
        } catch (err) { console.error(err); }
    };

    const getDateRange = () => {
        if (period === 'daily') return {
            start: new Date(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0),
            end: new Date(selectedYear, selectedMonth - 1, selectedDay, 23, 59, 59)
        };
        if (period === 'monthly') return {
            start: new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0),
            end: new Date(selectedYear, selectedMonth, 0, 23, 59, 59)
        };
        return {
            start: new Date(selectedYear, 0, 1, 0, 0, 0),
            end: new Date(selectedYear, 11, 31, 23, 59, 59)
        };
    };

    const { start, end } = getDateRange();
    const filteredTrips = trips.filter(t => t.status === 'Completed' && t.endTime && new Date(t.endTime) >= start && new Date(t.endTime) <= end);
    const filteredExpenses = expenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);

    // Group by driver
    const groups = {};
    filteredTrips.forEach(t => {
        const n = t.driver?.name || '-';
        if (!groups[n]) groups[n] = { trips: [], expenses: [] };
        groups[n].trips.push(t);
    });
    filteredExpenses.forEach(e => {
        const n = e.driver?.name || '-';
        if (!groups[n]) groups[n] = { trips: [], expenses: [] };
        groups[n].expenses.push(e);
    });

    const fmtTime = (str) => {
        if (!str) return '-';
        const d = new Date(str);
        return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    };

    const titles = { daily: 'كشف حساب يومي', monthly: 'كشف حساب شهري', yearly: 'كشف حساب سنوي' };
    const now = new Date();
    const COLS = 10;

    const c = { border: '1px solid var(--border-color)', padding: '8px 12px', textAlign: 'center' };
    const cR = { ...c, textAlign: 'right' };
    const hdr = { background: 'var(--gray-200)', fontWeight: 700 };
    const sub = { background: 'var(--gray-100)', fontWeight: 700 };
    const grd = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800 };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>{titles[period]}</h2>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                    {period === 'daily' && (
                        <>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>يوم</div>
                                <input type="text" inputMode="numeric" value={selectedDay}
                                    onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 31) setSelectedDay(v); else if (e.target.value === '') setSelectedDay(''); }}
                                    onBlur={() => { if (!selectedDay) setSelectedDay(now.getDate()); }}
                                    style={{ width: '45px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                            </div>
                            <span style={{ fontSize: '1.3rem', color: 'var(--gray-400)', marginTop: '14px' }}>/</span>
                        </>
                    )}
                    {(period === 'daily' || period === 'monthly') && (
                        <>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>شهر</div>
                                <input type="text" inputMode="numeric" value={selectedMonth}
                                    onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 12) setSelectedMonth(v); else if (e.target.value === '') setSelectedMonth(''); }}
                                    onBlur={() => { if (!selectedMonth) setSelectedMonth(now.getMonth() + 1); }}
                                    style={{ width: '45px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                            </div>
                            <span style={{ fontSize: '1.3rem', color: 'var(--gray-400)', marginTop: '14px' }}>/</span>
                        </>
                    )}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>سنة</div>
                        <input type="text" inputMode="numeric" value={selectedYear}
                            onChange={(e) => { const v = parseInt(e.target.value); if (v > 0) setSelectedYear(v); else if (e.target.value === '') setSelectedYear(''); }}
                            onBlur={() => { if (!selectedYear) setSelectedYear(now.getFullYear()); }}
                            style={{ width: '60px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        />
                    </div>
                    <button className="btn btn-primary no-print" onClick={() => window.print()} style={{ marginRight: 'auto', marginTop: '14px' }}>طباعة</button>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                    <thead>
                        <tr style={hdr}>
                            <th style={c}>#</th>
                            <th style={c}>السائق</th>
                            <th style={c}>الاجرة</th>
                            <th style={c}>قيمة</th>
                            <th style={c}>صندوق</th>
                            <th style={c}>ايراد</th>
                            <th style={c}>بنزين</th>
                            <th style={c}>مديونية</th>
                            <th style={c}>الوقت</th>
                            <th style={c}>العميل</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(groups).map(([driverName, data]) => {
                            const dTrips = data.trips;
                            const dExp = data.expenses;

                            // Driver totals
                            const dAjra = dTrips.reduce((a, t) => a + (t.fixedPrice || t.hourlyRate || t.finalTotal), 0);
                            const dQima = dTrips.reduce((a, t) => a + t.finalTotal, 0);
                            const dSondoq = dTrips.filter(t => t.paymentMethod === 'Cash').reduce((a, t) => a + t.paidAmount, 0);
                            const dIrad = dTrips.filter(t => t.paymentMethod !== 'Cash').reduce((a, t) => a + t.paidAmount, 0);
                            const dDebt = dTrips.reduce((a, t) => a + Math.max(0, t.finalTotal - t.paidAmount), 0);
                            const dFuel = dExp.reduce((a, e) => a + e.amount, 0);

                            // All rows sorted by date
                            const rows = [
                                ...dTrips.map(t => ({ ...t, _t: 'trip', _d: t.endTime })),
                                ...dExp.map(e => ({ ...e, _t: 'exp', _d: e.date }))
                            ].sort((a, b) => new Date(a._d) - new Date(b._d));

                            let num = 0;

                            return (
                                <React.Fragment key={driverName}>
                                    {rows.map(r => {
                                        num++;
                                        if (r._t === 'trip') {
                                            const isCash = r.paymentMethod === 'Cash';
                                            const baseFare = r.fixedPrice || r.hourlyRate || r.finalTotal;
                                            const rowDebt = Math.max(0, r.finalTotal - r.paidAmount);
                                            return (
                                                <tr key={`t-${r.id}`}>
                                                    <td style={c}>{num}</td>
                                                    <td style={cR}>{driverName}</td>
                                                    <td style={c}>{baseFare.toFixed(0)}</td>
                                                    <td style={c}>{r.finalTotal.toFixed(0)}</td>
                                                    <td style={c}>{isCash ? r.paidAmount.toFixed(0) : '0'}</td>
                                                    <td style={c}>{!isCash ? r.paidAmount.toFixed(0) : '0'}</td>
                                                    <td style={c}>0</td>
                                                    <td style={c}>{rowDebt > 0 ? rowDebt.toFixed(0) : '0'}</td>
                                                    <td style={{ ...c, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{fmtTime(r.endTime)}</td>
                                                    <td style={cR}>{r.customer?.name || '-'}</td>
                                                </tr>
                                            );
                                        } else {
                                            return (
                                                <tr key={`e-${r.id}`}>
                                                    <td style={c}>{num}</td>
                                                    <td style={cR}>{driverName}</td>
                                                    <td style={c}></td>
                                                    <td style={c}></td>
                                                    <td style={c}></td>
                                                    <td style={c}></td>
                                                    <td style={{ ...c, color: 'var(--danger-color)' }}>{r.amount.toFixed(0)}</td>
                                                    <td style={c}></td>
                                                    <td style={c}></td>
                                                    <td style={cR}>بنزين</td>
                                                </tr>
                                            );
                                        }
                                    })}
                                    {/* اجمالي سائق */}
                                    <tr style={sub}>
                                        <td style={c}></td>
                                        <td style={{ ...cR, fontWeight: 800 }}>اجمالي سائق</td>
                                        <td style={{ ...c, fontWeight: 700 }}>{dAjra.toFixed(0)}</td>
                                        <td style={{ ...c, fontWeight: 700 }}>{dQima.toFixed(0)}</td>
                                        <td style={{ ...c, fontWeight: 700 }}>{dSondoq.toFixed(0)}</td>
                                        <td style={{ ...c, fontWeight: 700 }}>{dIrad.toFixed(0)}</td>
                                        <td style={{ ...c, fontWeight: 700, color: 'var(--danger-color)' }}>{dFuel.toFixed(0)}</td>
                                        <td style={{ ...c, fontWeight: 700 }}>{dDebt.toFixed(0)}</td>
                                        <td style={c}></td>
                                        <td style={c}></td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                        {filteredTrips.length === 0 && filteredExpenses.length === 0 && (
                            <tr><td style={{ ...c, padding: '2rem', color: 'var(--gray-400)' }} colSpan={COLS}>لا توجد بيانات</td></tr>
                        )}
                    </tbody>
                    {(filteredTrips.length > 0 || filteredExpenses.length > 0) && (
                        <tfoot>
                            <tr style={grd}>
                                <td style={{ ...c, border: 'none' }} colSpan="2">الإجمالي</td>
                                <td style={{ ...c, border: 'none' }}>{filteredTrips.reduce((s, t) => s + (t.fixedPrice || t.hourlyRate || t.finalTotal), 0).toFixed(0)}</td>
                                <td style={{ ...c, border: 'none' }}>{filteredTrips.reduce((s, t) => s + t.finalTotal, 0).toFixed(0)}</td>
                                <td style={{ ...c, border: 'none' }}>{filteredTrips.filter(t => t.paymentMethod === 'Cash').reduce((s, t) => s + t.paidAmount, 0).toFixed(0)}</td>
                                <td style={{ ...c, border: 'none' }}>{filteredTrips.filter(t => t.paymentMethod !== 'Cash').reduce((s, t) => s + t.paidAmount, 0).toFixed(0)}</td>
                                <td style={{ ...c, border: 'none', color: '#f87171' }}>{filteredExpenses.reduce((s, e) => s + e.amount, 0).toFixed(0)}</td>
                                <td style={{ ...c, border: 'none' }}>{filteredTrips.reduce((s, t) => s + Math.max(0, t.finalTotal - t.paidAmount), 0).toFixed(0)}</td>
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
