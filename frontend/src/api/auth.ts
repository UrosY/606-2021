import { authClient } from './client';
import type { AuthResponse, RegisterData, LoginData } from '../types';

export const authAPI = {
  register: async (data: RegisterData): Promise<{ message: string }> => {
    const response = await authClient.post('/register', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await authClient.post('/login', data);
    return response.data;
  }
};
