import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { SOURCE_LABELS } from '../components/paymentSources';


const readUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
};

export default function Salaries() {
  const { showToast } = useToast();
  const isAdmin = readUser().role === 'Admin';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({}); // driverId -> { baseSalary, commissionPercent, allowances, deductions }
  const [defaultPercent, setDefaultPercent] = useState('');
  const [earnings, setEarnings] = useState({}); // driverId -> driver earnings row (money collected this month)
  const [open, setOpen] = useState({});

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchSalaries = useCallback(async () => {
    if (!month || !year) return;
    setLoading(true);
    try {
      const [res, earn] = await Promise.all([
        api.get(`/Salaries?month=${month}&year=${year}`),
        api.get(`/Reports/driver-earnings?period=monthly&year=${year}&month=${month}`).catch(() => null)
      ]);
      setEarnings(Object.fromEntries((earn?.data?.drivers || []).map(d => [d.driverId, d])));
      setData(res.data);
      setDefaultPercent(res.data.defaultCommissionPercent);
      const inputs = {};
      (res.data.drivers || []).forEach(d => {
        inputs[d.driverId] = {
          baseSalary: d.baseSalary || '',
          commissionPercent: d.usesDefaultCommission ? '' : d.commissionPercent,
          allowances: d.allowances || '',
          deductions: d.deductions || '',
          notes: d.notes || ''
        };
      });
      setEdits(inputs);
    } catch {
      // shown by the global error handler
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);

  const setField = (driverId, field, value) =>
    setEdits(prev => ({ ...prev, [driverId]: { ...prev[driverId], [field]: value } }));

  // Saved when the field loses focus
  const saveDriver = async (driverId) => {
    const e = edits[driverId];
    try {
      await api.put(`/Salaries/${driverId}?month=${month}&year=${year}`, {
        baseSalary: parseFloat(e.baseSalary) || 0,
        commissionPercent: e.commissionPercent === '' ? null : parseFloat(e.commissionPercent),
        useDefaultCommission: e.commissionPercent === '',
        allowances: parseFloat(e.allowances) || 0,
        deductions: parseFloat(e.deductions) || 0,
        notes: e.notes || null
      });
      fetchSalaries();
    } catch {
      fetchSalaries();
    }
  };

  const saveDefaultPercent = async () => {
    const value = parseFloat(defaultPercent);
    if (isNaN(value) || value === data?.defaultCommissionPercent) return;
    try {
      await api.put('/Salaries/settings', { defaultCommissionPercent: value });
      showToast('تم حفظ النسبة الافتراضية', 'success');
      fetchSalaries();
    } catch {
      setDefaultPercent(data?.defaultCommissionPercent ?? '');
    }
  };

  const pay = async (driverIds) => {
    const message = driverIds ? 'تأكيد صرف راتب هذا السائق؟ بعد الصرف لا يمكن تعديل الأرقام.' : 'تأكيد صرف رواتب كل السائقين لهذا الشهر؟ بعد الصرف لا يمكن تعديل الأرقام.';
    if (!window.confirm(message)) return;
    try {
      const res = await api.post('/Salaries/pay', { year, month, driverIds });
      showToast(`تم صرف ${res.data.paid} راتب بإجمالي ${res.data.total}`, 'success');
      fetchSalaries();
    } catch {
      // shown by the global error handler
    }
  };

  const unpay = async (driverId) => {
    if (!window.confirm('إعادة فتح الراتب للتعديل؟')) return;
    try {
      await api.post(`/Salaries/${driverId}/unpay?month=${month}&year=${year}`);
      fetchSalaries();
    } catch {
      // shown by the global error handler
    }
  };

  const c = { border: '1px solid var(--border-color)', padding: '8px 12px', textAlign: 'center' };
  const cR = { ...c, textAlign: 'right' };
  const hdr = { background: 'var(--gray-200)', fontWeight: 700 };
  const sub = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800 };
  const inputStyle = { width: '70px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', fontSize: '0.9rem' };
  // 3,016 or 12.5: thousands separated, no trailing .0
  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fmtDate = (str) => str ? new Date(str).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' }) : '-';

  const drivers = data?.drivers || [];
  const totals = data?.totals;
  const unpaidCount = drivers.filter(d => !d.isPaid).length;

  const numberCell = (d, field, placeholder) => (
    <td style={c}>
      {d.isPaid ? fmt(d[field]) : (
        <input type="number" min="0" value={edits[d.driverId]?.[field] ?? ''} placeholder={placeholder}
          onChange={(e) => setField(d.driverId, field, e.target.value)}
          onBlur={() => saveDriver(d.driverId)}
          style={inputStyle} />
      )}
    </td>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>تقرير الرواتب</h2>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>شهر</div>
            <input type="text" inputMode="numeric" value={month}
              onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 12) setMonth(v); else if (e.target.value === '') setMonth(''); }}
              onBlur={() => { if (!month) setMonth(now.getMonth() + 1); }}
              style={{ width: '45px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            />
          </div>
          <span style={{ fontSize: '1.3rem', color: 'var(--gray-400)', marginTop: '14px' }}>/</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>سنة</div>
            <input type="text" inputMode="numeric" value={year}
              onChange={(e) => { const v = parseInt(e.target.value); if (v > 0) setYear(v); else if (e.target.value === '') setYear(''); }}
              onBlur={() => { if (!year) setYear(now.getFullYear()); }}
              style={{ width: '60px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            />
          </div>
          <div style={{ textAlign: 'center', marginRight: '12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>النسبة الافتراضية %</div>
            <input type="number" min="0" max="100" value={defaultPercent}
              onChange={(e) => setDefaultPercent(e.target.value)}
              onBlur={saveDefaultPercent}
              style={{ width: '60px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            />
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '8px', marginRight: 'auto', marginTop: '14px' }}>
            {unpaidCount > 0 && (
              <button className="btn btn-success" onClick={() => pay(null)}>صرف رواتب الشهر</button>
            )}
            <button className="btn btn-primary" onClick={() => window.print()}>طباعة</button>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '8px' }}>
          العمولة = النسبة × (المحصّل من العملاء خلال الشهر − البنزين). المحصّل هو المبالغ التي دُفعت فعلاً عن مشاوير السائق، ويُوزَّع أي تحويل على أقدم المشاوير أولاً. اضغط على اسم السائق لعرض التفاصيل. ترك خانة النسبة فارغة يعني استخدام النسبة الافتراضية. تُحفظ التعديلات تلقائياً عند مغادرة الخانة.
        </div>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>جاري التحميل...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={hdr}>
                <th style={c}>#</th>
                <th style={c}>السائق</th>
                <th style={c}>راتب</th>
                <th style={c}>المحصّل</th>
                <th style={c}>بنزين</th>
                <th style={c}>صافي</th>
                <th style={c}>النسبة %</th>
                <th style={c}>عمولة</th>
                <th style={c}>بدلات</th>
                <th style={c}>خصم / سلف</th>
                <th style={c}>الإجمالي</th>
                <th style={c} className="no-print">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => {
                const details = earnings[d.driverId]?.payments || [];
                return (
                <React.Fragment key={d.driverId}>
                <tr style={d.isPaid ? { background: 'var(--success-bg)' } : undefined}>
                  <td style={c}>{i + 1}</td>
                  <td style={{ ...cR, cursor: details.length ? 'pointer' : 'default' }}
                    onClick={() => details.length && setOpen(o => ({ ...o, [d.driverId]: !o[d.driverId] }))}>
                    {details.length > 0 && <span className="no-print">{open[d.driverId] ? '▾ ' : '◂ '}</span>}
                    {d.driverName}
                  </td>
                  {numberCell(d, 'baseSalary')}
                  <td style={c}>{fmt(d.totalIncome)}</td>
                  <td style={{ ...c, color: 'var(--danger-color)' }}>{fmt(d.totalExpenses)}</td>
                  <td style={c}>{fmt(d.netIncome)}</td>
                  {d.isPaid ? <td style={c}>{fmt(d.commissionPercent)}</td> : numberCell(d, 'commissionPercent', String(data?.defaultCommissionPercent ?? ''))}
                  <td style={c}>{fmt(d.commission)}</td>
                  {numberCell(d, 'allowances', '0')}
                  {numberCell(d, 'deductions', '0')}
                  <td style={{ ...c, fontWeight: 700 }}>{fmt(d.totalSalary)}</td>
                  <td style={c} className="no-print">
                    {d.isPaid ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                        <span className="badge badge-success">مصروف</span>
                        {isAdmin && <button className="btn" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => unpay(d.driverId)}>فتح</button>}
                      </div>
                    ) : (
                      <button className="btn btn-success" style={{ padding: '3px 8px', fontSize: '12px' }} onClick={() => pay([d.driverId])}>صرف</button>
                    )}
                  </td>
                </tr>
                {open[d.driverId] && (
                  <tr>
                    <td style={{ ...c, background: 'var(--gray-100)', padding: '6px 12px' }} colSpan="12">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th style={cR}>العميل</th>
                            <th style={c}>يوم المشوار</th>
                            <th style={c}>المبلغ</th>
                            <th style={c}>طريقة الدفع</th>
                            <th style={c}>تاريخ التحصيل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.map((p, k) => (
                            <tr key={k}>
                              <td style={cR}>{p.customerName || '-'}</td>
                              <td style={c}>{fmtDate(p.tripDate)}</td>
                              <td style={c}>{fmt(p.amount)}</td>
                              <td style={c}>{SOURCE_LABELS[p.source] || p.source}</td>
                              <td style={c}>{fmtDate(p.collectedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {earnings[d.driverId]?.outstanding > 0 && (
                        <div style={{ marginTop: '6px', color: 'var(--gray-500)' }}>
                          متبقي على العملاء من مشاوير السائق: {fmt(earnings[d.driverId].outstanding)} (يُضاف إلى العمولة عند سداده)
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
              {drivers.length === 0 && (
                <tr><td style={{ ...c, padding: '2rem', color: 'var(--gray-400)' }} colSpan="12">لا توجد بيانات</td></tr>
              )}
            </tbody>
            {drivers.length > 0 && totals && (
              <tfoot>
                <tr style={sub}>
                  <td style={{ ...c, border: 'none' }} colSpan="2">مجموع كلي</td>
                  <td style={{ ...c, border: 'none' }}>{fmt(totals.totalBaseSalary)}</td>
                  <td style={{ ...c, border: 'none' }}>{fmt(totals.totalIncome)}</td>
                  <td style={{ ...c, border: 'none', color: '#f87171' }}>{fmt(totals.totalExpenses)}</td>
                  <td style={{ ...c, border: 'none' }}>{fmt(totals.totalNetIncome)}</td>
                  <td style={{ ...c, border: 'none' }}></td>
                  <td style={{ ...c, border: 'none' }}>{fmt(totals.totalCommission)}</td>
                  <td style={{ ...c, border: 'none' }}>{fmt(totals.totalAllowances)}</td>
                  <td style={{ ...c, border: 'none' }}>{fmt(totals.totalDeductions)}</td>
                  <td style={{ ...c, border: 'none' }}>{fmt(totals.totalSalaries)}</td>
                  <td style={{ ...c, border: 'none' }} className="no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
