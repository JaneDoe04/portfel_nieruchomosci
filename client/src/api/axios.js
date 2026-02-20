import axios from 'axios';
import { getToken, clearAuth } from '../utils/authStorage';

// Backend na Renderze: ustaw VITE_API_URL w client/.env (np. https://portfel-nieruchomosci.onrender.com)
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearAuth();
      // replace żeby przyciskiem "wstecz" nie wracać do chronionej strony
      window.location.replace('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
