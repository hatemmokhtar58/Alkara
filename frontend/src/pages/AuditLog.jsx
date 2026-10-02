import { useState, useEffect } from 'react';
import api from '../api';
import Pager from '../components/Pager';

const PAGE_SIZE = 50;

const ENTITIES = {
  Trip: 'مشوار',
  Customer: 'عميل',
  Driver: 'سائق',
  Car: 'سيارة',
  Expense: 'مصروف',
  WalletTransaction: 'حركة محفظة',
  DriverMonthlySalary: 'راتب',
  AppSetting: 'إعداد',
  User: 'مستخدم'
};

const ACTIONS = {
  Created: { label: 'إضافة', badge: 'badge-success' },
  Updated: { label: 'تعديل', badge: 'badge-warning' },
  Deleted: { label: 'حذف', badge: 'badge-danger' },
  Login: { label: 'دخول', badge: '' },
  LoginFailed: { label: 'دخول فاشل', badge: 'badge-danger' }
};

const show = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const text = String(v);
  // Dates are stored in Saudi time: 2026-10-02T14:51:44.36 -> 2026-10-02 14:51
  const date = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return date ? `${date[1]} ${date[2]}` : text;
};

// Field: value for created/deleted rows, field: old → new for updates.
function Changes({ json, action }) {
  if (!json) return null;
  let data;
  try { data = JSON.parse(json); } catch { return <span>{json}</span>; }
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.82rem' }}>
      {entries.map(([field, value]) => (
        <div key={field}>
          <span style={{ color: 'var(--gray-500)' }} dir="ltr">{field}</span>{': '}
          {action === 'Updated' && Array.isArray(value)
            ? <><s style={{ color: 'var(--danger-color)' }}>{show(value[0])}</s>{' ← '}<b>{show(value[1])}</b></>
            : <span>{show(value)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function AuditLog() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ page, pageSize: PAGE_SIZE });
    if (entityType) params.set('entityType', entityType);
    if (action) params.set('action', action);
    setLoading(true);
    api.get(`/Audit?${params}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, entityType, action]);

  const cell = { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top', textAlign: 'right' };
  const select = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'inherit' };

  return (
    <div>
      <h1 className="page-title">سجل التعديلات</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={select} value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }}>
            <option value="">كل الأنواع</option>
            {Object.entries(ENTITIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select style={select} value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
            <option value="">كل العمليات</option>
            {Object.entries(ACTIONS).map(([key, a]) => <option key={key} value={key}>{a.label}</option>)}
          </select>
          <span style={{ color: 'var(--gray-500)', marginRight: 'auto' }}>الإجمالي: {data.total}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--gray-100)' }}>
                <th style={cell}>الوقت</th>
                <th style={cell}>المستخدم</th>
                <th style={cell}>العملية</th>
                <th style={cell}>على</th>
                <th style={cell}>التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(log => (
                <tr key={log.id}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }} dir="ltr">{new Date(log.at).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'short', timeStyle: 'medium' })}</td>
                  <td style={cell}>{log.username || 'النظام'}</td>
                  <td style={cell}><span className={`badge ${ACTIONS[log.action]?.badge || ''}`}>{ACTIONS[log.action]?.label || log.action}</span></td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{ENTITIES[log.entityType] || log.entityType}{log.entityId ? ` #${log.entityId}` : ''}</td>
                  <td style={{ ...cell, maxWidth: '520px', wordBreak: 'break-word' }}><Changes json={log.changes} action={log.action} /></td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr><td style={{ ...cell, textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }} colSpan="5">لا توجد سجلات</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
      </div>
    </div>
  );
}
