import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const PAGE_SIZE = 50;

const EVENTS = {
  Created: 'تأكيد حجز',
  Ongoing: 'بدء المشوار',
  Completed: 'انتهاء المشوار',
  Cancelled: 'إلغاء',
  Postponed: 'تغيير موعد',
  Departed: 'خروج السائق',
  Test: 'رسالة تجربة'
};

export default function SmsLog() {
  const { showToast } = useToast();
  const [data, setData] = useState({ total: 0, items: [] });
  const [page, setPage] = useState(1);
  const [failedOnly, setFailedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [sending, setSending] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/Sms/logs?page=${page}&pageSize=${PAGE_SIZE}&failedOnly=${failedOnly}`);
      setData(res.data);
    } catch {
      // shown by the global error handler
    }
    setLoading(false);
  }, [page, failedOnly]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const sendTest = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/Sms/test', { phone: testPhone });
      showToast(res.data.message, 'success');
    } catch {
      // shown by the global error handler
    }
    setSending(false);
    setPage(1);
    fetchLogs();
  };

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const cell = { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' };

  return (
    <div>
      <h1 className="page-title">سجل الرسائل</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={sendTest} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">إرسال رسالة تجربة إلى</label>
            <input className="form-control" type="tel" dir="ltr" placeholder="05XXXXXXXX" value={testPhone} onChange={e => setTestPhone(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'جاري الإرسال...' : 'إرسال تجربة'}</button>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={failedOnly} onChange={e => { setFailedOnly(e.target.checked); setPage(1); }} />
            الفاشلة فقط
          </label>
          <span style={{ color: 'var(--gray-500)' }}>الإجمالي: {data.total}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--gray-100)', textAlign: 'right' }}>
                <th style={cell}>الوقت</th>
                <th style={cell}>الجوال</th>
                <th style={cell}>النوع</th>
                <th style={cell}>المشوار</th>
                <th style={cell}>الرسالة</th>
                <th style={cell}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(log => (
                <tr key={log.id}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }} dir="ltr">{new Date(log.sentAt).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td style={cell} dir="ltr">{log.phone}</td>
                  <td style={cell}>{EVENTS[log.event] || log.event}</td>
                  <td style={cell}>{log.tripId ? `#${log.tripId}` : '-'}</td>
                  <td style={{ ...cell, maxWidth: '380px' }}>{log.message}</td>
                  <td style={cell}>
                    {log.success
                      ? <span className="badge badge-success">تم الإرسال</span>
                      : <span className="badge badge-danger" title={log.error || ''}>فشل{log.error ? `: ${log.error}` : ''}</span>}
                  </td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr><td style={{ ...cell, textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }} colSpan="6">لا توجد رسائل</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1rem', alignItems: 'center' }}>
            <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</button>
            <span>{page} / {pages}</span>
            <button className="btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>التالي</button>
          </div>
        )}
      </div>
    </div>
  );
}
