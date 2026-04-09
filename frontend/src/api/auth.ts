import client from './client'
import type { TokenResponse, Usuario } from '@/types'

export const authApi = {
  login: (username: string, password: string) =>
    client.post<TokenResponse>('/auth/login', { username, password }),

  logout: () => client.post('/auth/logout'),

  me: () => client.get<Usuario>('/auth/me'),

  updateMe: (data: Partial<Pick<Usuario, 'full_name' | 'email' | 'telefono' | 'indicativo'>>) =>
    client.put<Usuario>('/auth/me', data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post<Usuario>('/auth/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  changePassword: (new_password: string, confirm_password: string) =>
    client.post('/auth/change-password', { new_password, confirm_password }),

  refresh: (refresh_token: string) =>
    client.post<TokenResponse>('/auth/refresh', { refresh_token }),
}
