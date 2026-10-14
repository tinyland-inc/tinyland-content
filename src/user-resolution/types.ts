



export interface AdminUser {
  id: string;
  handle: string;
  displayName: string;
  role: string;
  avatar?: string;
  bio?: string;
  pronouns?: string;
  location?: string;
  website?: string;
  [key: string]: unknown;
}




export interface Profile {
  slug: string;
  metadata: {
    handle?: string;
    name?: string;
    displayName?: string;
    role?: string;
    avatar?: string;
    bio?: string;
    pronouns?: string;
    location?: string;
    website?: string;
    social?: { website?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}




export interface ResolvedUser {
  
  handle: string;
  
  displayName: string;
  
  source: 'directory' | 'profile' | 'noauth';
  
  id?: string;
  
  role: string;
  
  avatar?: string;
  
  bio?: string;
  
  pronouns?: string;
  
  location?: string;
  
  website?: string;
  
  dbUser?: AdminUser;
}
