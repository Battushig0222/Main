import { Manga } from './types';

export const ADMIN_CREDENTIALS = {
  username: 'Battushig',
  password: 'RGT_YTHAPPY'
};

export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://pscmduppekeizrktaeog.supabase.co',
  key: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_h1FKjq-JadlOBtHA2KbLfg_ZlW8d_RY'
};

export const INITIAL_MANGA: Manga[] = [];