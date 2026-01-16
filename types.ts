
export interface Manga {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  genre: string[];
  gallery: string[]; // Additional images/art
  status: 'Ongoing' | 'Completed';
  chapters: Chapter[];
  rating: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  pages: string[]; // URLs to images (Base64 for local storage)
  createdAt: string;
}

export interface User {
  username: string;
  role: 'admin' | 'user';
}

export interface AdminAccount {
  username: string;
  password: string;
  isSuperAdmin?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
