import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';

export default function Salaries() {
  const { t } = useTranslation();
  const currency = t('Dashboard.Currency');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [percentage, setPercentage] = useState(10);
  const [deductions, setDeductions] = useState({});
  const [allowances, setAllowances] = useState({});
  const [salaryInputs, setSalaryInputs] = useState({});
  const saveTimers = useRef({});

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/Salaries?month=${month}&year=${year}&percentage=${percentage}`);
      setData(res.data);
      // Initialize salary inputs from backend data
      const inputs = {};
      (res.data.drivers || []).forEach(d => {
        inputs[d.driverId] = d.baseSalary > 0 ? d.baseSalary : '';
      });
      setSalaryInputs(inputs);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchSalaries(); }, [month, year, percentage]);

  // Auto-save salary when changed
  const handleSalaryChange = (driverId, value) => {
    const numVal = parseFloat(value) || 0;
    setSalaryInputs(prev => ({ ...prev, [driverId]: value }));

    // Clear previous timer
    if (saveTimers.current[driverId]) clearTimeout(saveTimers.current[driverId]);

    // Auto-save after 800ms
    saveTimers.current[driverId] = setTimeout(async () => {
      try {
        const driverRes = await api.get(`/Drivers/${driverId}`);
        const driver = driverRes.data;
        await api.put(`/Drivers/${driverId}`, { ...driver, baseSalary: numVal });
        fetchSalaries();
      } catch (err) { console.error(err); }
    }, 800);
  };

  const c = { border: '1px solid var(--border-color)', padding: '8px 12px', textAlign: 'center' };
  const cR = { ...c, textAlign: 'right' };
  const hdr = { background: 'var(--gray-200)', fontWeight: 700 };
  const sub = { background: 'var(--gray-800)', color: '#fff', fontWeight: 800 };
  const inputStyle = { width: '70px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', fontSize: '0.9rem' };

  const drivers = data?.drivers || [];
  const totBaseSalary = drivers.reduce((s, d) => s + (parseFloat(salaryInputs[d.driverId]) || 0), 0);
  const totIncome = drivers.reduce((s, d) => s + d.totalIncome, 0);
  const totExpenses = drivers.reduce((s, d) => s + d.totalExpenses, 0);
  const totNet = drivers.reduce((s, d) => s + d.netIncome, 0);
  const totCommission = drivers.reduce((s, d) => s + (d.commission || 0), 0);
  const totAllowances = Object.values(allowances).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totDeductions = Object.values(deductions).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const getDriverTotal = (d) => {
    const base = parseFloat(salaryInputs[d.driverId]) || 0;
    const comm = d.commission || 0;
    const allow = parseFloat(allowances[d.driverId]) || 0;
    const ded = parseFloat(deductions[d.driverId]) || 0;
    return base + comm + allow - ded;
  };

  const totTotal = drivers.reduce((s, d) => s + getDriverTotal(d), 0);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
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
            <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' }}>النسبة %</div>
            <input type="text" inputMode="numeric" value={percentage}
              onChange={(e) => { const v = parseInt(e.target.value); if (v >= 0 && v <= 100) setPercentage(v); else if (e.target.value === '') setPercentage(''); }}
              onBlur={() => { if (!percentage && percentage !== 0) setPercentage(10); }}
              style={{ width: '45px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            />
          </div>
          <button className="btn btn-primary no-print" onClick={() => window.print()} style={{ marginRight: 'auto', marginTop: '14px' }}>طباعة</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>جاري التحميل...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={hdr}>
                <th style={c}>#</th>
                <th style={c}>السائق</th>
                <th style={c}>راتب</th>
                <th style={c}>ايراد</th>
                <th style={c}>بنزين</th>
                <th style={c}>صافي</th>
                <th style={c}>عمولة</th>
                <th style={c}>بدلات</th>
                <th style={c}>خصم</th>
                <th style={c}>الاجمالي</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => {
                const total = getDriverTotal(d);
                return (
                  <tr key={d.driverId}>
                    <td style={c}>{i + 1}</td>
                    <td style={cR}>{d.driverName}</td>
                    <td style={c}>
                      <input type="number" value={salaryInputs[d.driverId] || ''}
                        onChange={(e) => handleSalaryChange(d.driverId, e.target.value)}
                        
                        style={inputStyle}
                      />
                    </td>
                    <td style={c}>{d.totalIncome.toFixed(0)}</td>
                    <td style={{ ...c, color: 'var(--danger-color)' }}>{d.totalExpenses.toFixed(0)}</td>
                    <td style={c}>{d.netIncome.toFixed(0)}</td>
                    <td style={c}>{(d.commission || 0).toFixed(1)}</td>
                    <td style={c}>
                      <input type="number" value={allowances[d.driverId] || ''}
                        onChange={(e) => setAllowances({ ...allowances, [d.driverId]: e.target.value })}
                        
                        style={inputStyle}
                      />
                    </td>
                    <td style={c}>
                      <input type="number" value={deductions[d.driverId] || ''}
                        onChange={(e) => setDeductions({ ...deductions, [d.driverId]: e.target.value })}
                        placeholder="0"
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ ...c, fontWeight: 700 }}>{total.toFixed(1)}</td>
                  </tr>
                );
              })}
              {drivers.length === 0 && (
                <tr><td style={{ ...c, padding: '2rem', color: 'var(--gray-400)' }} colSpan="10">لا توجد بيانات</td></tr>
              )}
            </tbody>
            {drivers.length > 0 && (
              <tfoot>
                <tr style={sub}>
                  <td style={{ ...c, border: 'none' }} colSpan="2">مجموع كلي</td>
                  <td style={{ ...c, border: 'none' }}>{totBaseSalary.toFixed(0)}</td>
                  <td style={{ ...c, border: 'none' }}>{totIncome.toFixed(0)}</td>
                  <td style={{ ...c, border: 'none', color: '#f87171' }}>{totExpenses.toFixed(0)}</td>
                  <td style={{ ...c, border: 'none' }}>{totNet.toFixed(0)}</td>
                  <td style={{ ...c, border: 'none' }}>{totCommission.toFixed(1)}</td>
                  <td style={{ ...c, border: 'none' }}>{totAllowances.toFixed(0)}</td>
                  <td style={{ ...c, border: 'none' }}>{totDeductions.toFixed(0)}</td>
                  <td style={{ ...c, border: 'none' }}>{totTotal.toFixed(1)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
