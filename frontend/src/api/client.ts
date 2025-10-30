import axios, { type AxiosInstance } from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001';
const FORMS_API_URL = import.meta.env.VITE_FORMS_API_URL || 'http://localhost:3002';

// Auth service client
export const authClient: AxiosInstance = axios.create({
  baseURL: AUTH_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Forms service client
export const formsClient: AxiosInstance = axios.create({
  baseURL: FORMS_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor to forms client
formsClient.interceptors.request.use((config) => {
  const token = tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling 401 errors
formsClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      tokenStorage.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Multipart client for file uploads
export const formsMultipartClient: AxiosInstance = axios.create({
  baseURL: FORMS_API_URL,
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});

formsMultipartClient.interceptors.request.use((config) => {
  const token = tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

formsMultipartClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      tokenStorage.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
