import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';

import { useToast } from '../context/ToastContext';

const Login = ({ setAuth }) => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    
    const toggleLanguage = () => {
        const newLang = i18n.language === 'ar' ? 'en' : 'ar';
        i18n.changeLanguage(newLang);
        document.body.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    };
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await api.post('/Auth/login', { username, password });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            showToast(t('Common.Success'), 'success');
            
            // Artificial delay to show off beautiful animation
            setTimeout(() => {
                setAuth(true);
                navigate('/');
            }, 600);
            
        } catch (err) {
            setIsLoading(false);
            // Global error handler in App.jsx will catch this, 
            // but we can also add specific login error if we want.
            // Actually, the global handler is enough.
        }
    };


    return (
        <div className="login-wrapper">
            <div className="login-form-container mesh-bg">
                {/* Language Toggle Button */}
                <button onClick={toggleLanguage} className="lang-toggle-btn">
                    {t('Sidebar.SwitchLang')}
                </button>

                <div className="login-card">
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <div style={{width: '60px', height: '60px', background: 'var(--primary-color)', borderRadius: '14px', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)', transform: 'rotate(-5deg)'}}>
                            <span style={{color: 'white', fontSize: '2rem', fontWeight: 'bold'}}>{t('Alkara').charAt(0)}</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-1px', marginBottom: '0.5rem' }}>
                            {t('Welcome')}
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '500' }}>{t('LoginPrompt')}</p>
                    </div>
                    
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <div className="form-group">
                            <label className="form-label">{t('Username')}</label>
                            <input 
                                type="text" 
                                className="form-control"
                                placeholder={t('UsernamePlaceholder')}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('Password')}</label>
                            <input 
                                type="password" 
                                className="form-control"
                                placeholder="..." 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1.2rem', marginTop: '1rem', fontSize: '1.2rem', letterSpacing: '1px' }} disabled={isLoading}>
                            {isLoading ? (
                                <span style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                    <span style={{ display:'inline-block', width:'20px', height:'20px', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 1s linear infinite' }}></span>
                                    {t('LoggingIn')}
                                </span>
                            ) : t('LoginBtn')}
                        </button>
                    </form>
                </div>
            </div>
            
            <div className="login-aside">
                <div className="login-aside-content">
                    <h2 style={{ fontSize: '4rem', fontWeight: '800', textShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>{t('LoginAsideTitle')}</h2>
                    <p style={{ fontSize: '1.5rem', opacity: '0.8', marginTop: '1rem', textShadow: '0 5px 10px rgba(0,0,0,0.5)' }}>{t('LoginAsideDesc')}</p>
                </div>
            </div>
            
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Login;
