
import { Manga } from './types';

export const ADMIN_CREDENTIALS = {
  username: 'Battushig',
  password: 'RGT_YTHAPPY'
};

export const SUPABASE_CONFIG = {
  url: 'https://pscmduppekeizrktaeog.supabase.co',
  key: 'sb_publishable_h1FKjq-JadlOBtHA2KbLfg_ZlW8d_RY'
};

export const INITIAL_MANGA: Manga[] = [
  {
    id: '1',
    title: 'One Piece',
    author: 'Eiichiro Oda',
    description: 'Gold Roger, the King of the Pirates, attained everything this world has to offer. The words he uttered just before his death sent people to the seas: "My fortune? If you want it, you can have it. Look for it! I left everything in that one place."',
    coverUrl: 'https://picsum.photos/seed/op/400/600',
    genre: ['Action', 'Adventure', 'Fantasy'],
    status: 'Ongoing',
    gallery: [],
    rating: 4.9,
    chapters: [
      {
        id: 'c1',
        number: 1,
        title: 'Romance Dawn',
        pages: ['https://picsum.photos/seed/page1/800/1200', 'https://picsum.photos/seed/page2/800/1200'],
        createdAt: '2023-10-01'
      }
    ]
  },
  {
    id: '2',
    title: 'Solo Leveling',
    author: 'Chugong',
    description: 'In a world where hunters, humans who possess magical abilities, must battle deadly monsters to protect the human race from certain annihilation, a notoriously weak hunter named Sung Jinwoo finds himself in a seemingly endless struggle for survival.',
    coverUrl: 'https://picsum.photos/seed/sl/400/600',
    genre: ['Action', 'Fantasy'],
    status: 'Completed',
    gallery: [],
    rating: 4.8,
    chapters: []
  }
];
