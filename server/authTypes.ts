export type TheaterAccessRole = 'owner' | 'editor' | 'observer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface TheaterAccessInfo {
  theaterId: string;
  role: TheaterAccessRole;
}

export interface AuthSessionPayload {
  user: AuthUser;
  theaters: TheaterAccessInfo[];
  isPlatformAdmin?: boolean;
}
