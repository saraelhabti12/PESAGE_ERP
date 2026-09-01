export interface Permission {
  id: number;
  module: string;
  action: string;
  code: string;
  description?: string;
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  permissions?: Permission[];
}

export interface User {
  id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  roles: Role[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
