import { useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const MIN_LENGTH = 8;

// Shown instead of the app when the account must pick a new password, or when the user opens it from the menu.
const ChangePassword = ({ forced, onDone, onCancel, onLogout }) => {
    const { showToast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword.length < MIN_LENGTH) {
            showToast(`كلمة المرور يجب أن تكون ${MIN_LENGTH} أحرف على الأقل.`, 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('تأكيد كلمة المرور غير مطابق.', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await api.post('/Auth/change-password', { currentPassword, newPassword });
            showToast('تم تغيير كلمة المرور بنجاح.', 'success');
            onDone(res.data);
        } catch {
            // The API error message is shown by the global error handler.
        }
        setSaving(false);
    };

    return (
        <div className="login-wrapper">
            <div className="login-form-container mesh-bg">
                <div className="login-card">
                    <h1 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.5rem', textAlign: 'center' }}>تغيير كلمة المرور</h1>
                    {forced && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem' }}>
                            يجب اختيار كلمة مرور جديدة خاصة بك قبل المتابعة.
                        </p>
                    )}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        <div className="form-group">
                            <label className="form-label">كلمة المرور الحالية</label>
                            <input type="password" className="form-control" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">كلمة المرور الجديدة ({MIN_LENGTH} أحرف على الأقل)</label>
                            <input type="password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">تأكيد كلمة المرور الجديدة</label>
                            <input type="password" className="form-control" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={saving}>
                            {saving ? '...' : 'حفظ كلمة المرور'}
                        </button>
                        {forced ? (
                            <button type="button" className="btn" style={{ width: '100%' }} onClick={onLogout}>تسجيل خروج</button>
                        ) : (
                            <button type="button" className="btn" style={{ width: '100%' }} onClick={onCancel}>رجوع</button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
