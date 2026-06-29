import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';

export default function DailyReport({ period = 'daily' }) {
    const { t } = useTranslation();
    const currency = t('Dashboard.Currency');

    const now = new Date();
    const [day, setDay] = useState(now.getDate());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const [trips, setTrips] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [walletTx, setWalletTx] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Build date range based on period
    const getDateRange = () => {
        if (period === 'daily') {
            const start = new Date(year, month - 1, day, 0, 0, 0);
            const end = new Date(year, month - 1, day, 23, 59, 59);
            return { start, end };
        } else if (period === 'monthly') {
            const start = new Date(year, month - 1, 1, 0, 0, 0);
            const end = new Date(year, month, 0, 23, 59, 59); // last day of month
            return { start, end };
        } else {
            const start = new Date(year, 0, 1, 0, 0, 0);
            const end = new Date(year, 11, 31, 23, 59, 59);
            return { start, end };
        }
    };

    // Build wallet API dates for the range
    const getWalletDates = () => {
        const { start, end } = getDateRange();
        const dates = [];
        const d = new Date(start);
        while (d <= end) {
            dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            d.setDate(d.getDate() + 1);
        }
        return dates;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tripsRes, expensesRes, driversRes] = await Promise.all([
                api.get('/Trips'),
                api.get('/Expenses'),
                api.get('/Drivers'),
            ]);
            setTrips(tripsRes.data);
            setExpenses(expensesRes.data);
            setDrivers(driversRes.data);

            // Fetch wallet transactions for the date range
            const dates = getWalletDates();
            const walletPromises = dates.map(d => api.get(`/Wallet/daily?date=${d}`).catch(() => ({ data: [] })));
            const walletResults = await Promise.all(walletPromises);
            const allWalletTx = walletResults.flatMap(r => r.data);
            // Remove duplicates by id
            const unique = [...new Map(allWalletTx.map(tx => [tx.id, tx])).values()];
            setWalletTx(unique);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [day, month, year, period]);

    const { start: startOfRange, end: endOfRange } = getDateRange();

    const dayTrips = trips.filter(tr => {
        if (tr.status !== 'Completed' || !tr.endTime) return false;
        const d = new Date(tr.endTime);
        return d >= startOfRange && d <= endOfRange;
    });

    const dayExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= startOfRange && d <= endOfRange;
    });

    const cashCollections = walletTx.filter(tx => tx.type === 'CashCollection');
    const adminDeposits = walletTx.filter(tx => tx.type === 'CashDeposit');

    const cashTrips = dayTrips.filter(tr => tr.paymentMethod === 'Cash');
    const totalCashTrips = cashTrips.reduce((s, tr) => s + tr.paidAmount, 0);

    // Group trips by driver
    const tripsByDriver = {};
    cashTrips.forEach(tr => {
        const dName = tr.driver?.name || '-';
        if (!tripsByDriver[dName]) tripsByDriver[dName] = { count: 0, total: 0 };
        tripsByDriver[dName].count++;
        tripsByDriver[dName].total += tr.paidAmount;
    });
    const driverTripRows = Object.entries(tripsByDriver);

    // Group expenses by driver
    const expByDriver = {};
    dayExpenses.forEach(exp => {
        const dName = exp.driver?.name || '-';
        if (!expByDriver[dName]) expByDriver[dName] = { count: 0, total: 0 };
        expByDriver[dName].count++;
        expByDriver[dName].total += exp.amount;
    });
    const driverExpRows = Object.entries(expByDriver);

    const totalAdminDeposits = adminDeposits.reduce((s, tx) => s + Math.abs(tx.amount), 0);
    const totalCashCollections = cashCollections.reduce((s, tx) => s + Math.abs(tx.amount), 0);
    const totalExpenses = dayExpenses.reduce((s, e) => s + e.amount, 0);
    const todayBalance = totalCashTrips + totalCashCollections + totalAdminDeposits - totalExpenses;

    const titles = { daily: 'حركة الصندوق - يومي', monthly: 'حركة الصندوق - شهري', yearly: 'حركة الصندوق - سنوي' };
    const netLabels = { daily: 'صافي اليوم', monthly: 'صافي الشهر', yearly: 'صافي السنة' };

    const tbl = { width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', fontSize: '1rem' };
    const cell = { border: '1px solid var(--border-color)', padding: '10px 14px', textAlign: 'center' };
    const cellR = { ...cell, textAlign: 'right' };
    const headerRow = { background: 'var(--gray-200)', fontWeight: 700 };
    const totalRow = { background: 'var(--gray-100)', fontWeight: 700 };
    const balanceRow = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800, fontSize: '1.1rem' };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>{titles[period]}</h2>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                    {/* Day - only for daily */}
                    {period === 'daily' && (
                        <>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>يوم</div>
                                <input type="text" inputMode="numeric" value={day}
                                    onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 31) setDay(v); else if (e.target.value === '') setDay(''); }}
                                    onBlur={() => { if (!day) setDay(now.getDate()); }}
                                    style={{ width: '45px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                            </div>
                            <span style={{ fontSize: '1.3rem', color: 'var(--gray-400)', marginTop: '14px' }}>/</span>
                        </>
                    )}
                    {/* Month - for daily and monthly */}
                    {(period === 'daily' || period === 'monthly') && (
                        <>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>شهر</div>
                                <input type="text" inputMode="numeric" value={month}
                                    onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 12) setMonth(v); else if (e.target.value === '') setMonth(''); }}
                                    onBlur={() => { if (!month) setMonth(now.getMonth() + 1); }}
                                    style={{ width: '45px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                            </div>
                            <span style={{ fontSize: '1.3rem', color: 'var(--gray-400)', marginTop: '14px' }}>/</span>
                        </>
                    )}
                    {/* Year - always */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>سنة</div>
                        <input type="text" inputMode="numeric" value={year}
                            onChange={(e) => { const v = parseInt(e.target.value); if (v > 0) setYear(v); else if (e.target.value === '') setYear(''); }}
                            onBlur={() => { if (!year) setYear(now.getFullYear()); }}
                            style={{ width: '60px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>جاري التحميل...</div>
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
                        {/* === 1. المشاوير === */}
                        {driverTripRows.map(([name, data], i) => (
                            <tr key={`drv-${name}`}>
                                <td style={cell}>{i + 1}</td>
                                <td style={cellR}>مشاوير {name} ({data.count})</td>
                                <td style={cellR}>{name}</td>
                                <td style={{ ...cell, fontWeight: 600 }}>{data.total.toFixed(2)}</td>
                                <td style={cell}>-</td>
                            </tr>
                        ))}
                        <tr style={totalRow}>
                            <td style={cell} colSpan="3">اجمالي المشاوير</td>
                            <td style={{ ...cell, fontWeight: 700 }}>{totalCashTrips.toFixed(2)}</td>
                            <td style={cell}>-</td>
                        </tr>

                        {/* === 2. التحصيل === */}
                        {[...cashCollections, ...adminDeposits].map((tx, i) => (
                            <tr key={`col-${tx.id}`}>
                                <td style={cell}>{i + 1}</td>
                                <td style={cellR}>{tx.type === 'CashCollection' ? 'تحصيل / كاش' : 'تحصيل / ادارة'}</td>
                                <td style={cellR}>{tx.customerName || '-'}</td>
                                <td style={{ ...cell, fontWeight: 600 }}>{Math.abs(tx.amount).toFixed(2)}</td>
                                <td style={cell}>-</td>
                            </tr>
                        ))}
                        <tr style={totalRow}>
                            <td style={cell} colSpan="3">اجمالي التحصيل</td>
                            <td style={{ ...cell, fontWeight: 700 }}>{(totalCashCollections + totalAdminDeposits).toFixed(2)}</td>
                            <td style={cell}>-</td>
                        </tr>

                        {/* === 3. المصروفات === */}
                        {driverExpRows.map(([name, data], i) => (
                            <tr key={`exp-${name}`}>
                                <td style={cell}>{i + 1}</td>
                                <td style={cellR}>بنزين {name} ({data.count})</td>
                                <td style={cellR}>{name}</td>
                                <td style={cell}>-</td>
                                <td style={{ ...cell, fontWeight: 600, color: 'var(--danger-color)' }}>{data.total.toFixed(2)}</td>
                            </tr>
                        ))}
                        <tr style={totalRow}>
                            <td style={cell} colSpan="3">اجمالي المصروفات</td>
                            <td style={cell}>-</td>
                            <td style={{ ...cell, fontWeight: 700, color: 'var(--danger-color)' }}>{totalExpenses.toFixed(2)}</td>
                        </tr>

                        {/* === 4. الصافي === */}
                        <tr style={balanceRow}>
                            <td style={{ ...cell, border: 'none' }} colSpan="3">{netLabels[period]}</td>
                            <td style={{ ...cell, border: 'none', fontSize: '1.1rem' }} colSpan="2">{todayBalance.toFixed(2)} {currency}</td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
}
