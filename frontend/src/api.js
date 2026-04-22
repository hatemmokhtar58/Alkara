import axios from 'axios';

// Create a specialized instance of Axios
const api = axios.create({
    baseURL: 'http://localhost:5144/api', // The exact port from your .NET backend
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

// Detect 401 Unauthorized and Global Errors
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        } else {
            // Global Error Dispatch for Wow Toasts
            const message = error.response?.data?.message || error.response?.data || error.message || 'Error occurred';
            window.dispatchEvent(new CustomEvent('system-error', { detail: message }));
        }
        return Promise.reject(error);
    }
);


export default api;
