export type ElectionStatus = 'not_started' | 'in_progress' | 'closed';

export interface User {
  id: string;
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
  password?: string;
}

export interface Candidate {
  id: string;
  user_id: string;
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
  id: string;
  user_id: string;
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
    id: string;
    username: string;
    name: string;
    x?: number;
    y?: number;
  }[];
  views?: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    viewed_at: string;
  }[];
}

export interface Post {
  id: string;
  author_id: string;
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
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  name: string;
  avatar: string;
  username: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  username: string;
  vote_count: number;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'register' | 'story_tag';
  post_id?: string;
  story_id?: string;
  is_read: number;
  created_at: string;
  actor_name: string;
  actor_avatar: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: number;
}

export interface Conversation {
  id: string;
  name: string;
  username: string;
  avatar: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}
