export type UserRole = 'admin' | 'client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  clientId?: string | null;
}

