import axios from 'axios';

// Create a specialized instance of Axios
const api = axios.create({
    baseURL: '/api', // Uses Vite proxy in dev, works with ngrok too
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor to inject Token
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const showError = (message) => {
    window.dispatchEvent(new CustomEvent('system-error', { detail: message }));
};

// Detect 401 Unauthorized and Global Errors
api.interceptors.response.use(
    response => response,
    error => {
        const status = error.response?.status;
        const data = error.response?.data;
        const isLogin = error.config?.url?.toLowerCase().includes('/auth/login');

        if (status === 401 && !isLogin) {
            // Session ended (expired token, password changed, or account removed)
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        } else if (status === 403 && data?.code === 'MustChangePassword') {
            window.dispatchEvent(new CustomEvent('must-change-password'));
        } else if (status === 429) {
            showError('محاولات كثيرة، حاول مرة أخرى بعد دقيقة.');
        } else {
            const message = data?.message
                || (typeof data === 'string' ? data : null)
                || (data?.errors ? Object.values(data.errors).flat().join(' ') : null)
                || data?.title
                || error.message
                || 'Error occurred';
            showError(message);
        }
        return Promise.reject(error);
    }
);


export default api;
