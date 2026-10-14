import type { AdminUser, Profile } from './types.js';








export interface UserResolutionConfig {
  
  findUserByHandle: (handle: string) => Promise<AdminUser | null>;
  
  findAllUsers: () => Promise<AdminUser[]>;
  
  loadProfiles: (filter: { handle?: string }) => Promise<Profile[]>;
  
  isNoAuthMode?: boolean;
}

let config: UserResolutionConfig | null = null;





export function configure(c: UserResolutionConfig): void {
  config = c;
}




export function getConfig(): UserResolutionConfig {
  if (!config) {
    throw new Error('tinyland-user-resolution: call configure() before use');
  }
  return config;
}




export function resetConfig(): void {
  config = null;
}
