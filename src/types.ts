export type ElectionStatus = 'not_started' | 'in_progress' | 'closed';

export interface User {
  id: number;
  username: string;
  name: string;
  avatar: string;
  email?: string;
  status?: 'active' | 'suspended' | 'pending';
  cover_url?: string;
  bio?: string;
  location?: string;
  join_date?: string;
  cover_position?: string;
  avatar_position?: string;
  is_verified?: number;
  is_approved?: number;
  role: 'admin' | 'candidate' | 'voter';
}

export interface Candidate {
  id: number;
  user_id: number;
  vision: string;
  mission: string;
  innovation_program?: string;
  image_url?: string;
  name: string;
  avatar: string;
  username: string;
  vote_count?: number;
}

export interface Story {
  id: number;
  user_id: number;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  expires_at: string;
  user_name: string;
  user_avatar: string;
  text_overlays?: {
    text: string;
    font: string;
    color: string;
    x: number;
    y: number;
    scale: number;
  }[];
  tags?: {
    id: number;
    username: string;
    name: string;
    x?: number;
    y?: number;
  }[];
  views?: {
    id: number;
    username: string;
    name: string;
    avatar: string;
    viewed_at: string;
  }[];
}

export interface Post {
  id: number;
  author_id: number;
  content: string;
  image_url: string | null;
  audio_url?: string | null;
  is_pinned?: number;
  created_at: string;
  updated_at?: string;
  name: string;
  avatar: string;
  username: string;
  likes_count: number;
  comments_count: number;
  is_liked: number;
  is_verified?: number;
}

export interface Comment {
  id: number;
  post_id: number;
  author_id: number;
  content: string;
  created_at: string;
  name: string;
  avatar: string;
  username: string;
}

export interface LeaderboardEntry {
  id: number;
  name: string;
  avatar: string;
  username: string;
  vote_count: number;
}

export interface Notification {
  id: number;
  user_id: number;
  actor_id: number;
  type: 'like' | 'comment' | 'register';
  post_id?: number;
  is_read: number;
  created_at: string;
  actor_name: string;
  actor_avatar: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  is_read: number;
}

export interface Conversation {
  id: number;
  name: string;
  username: string;
  avatar: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}
