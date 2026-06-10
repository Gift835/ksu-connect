import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          cover_url: string | null;
          location: string | null;
          website: string | null;
          is_private: boolean;
          is_verified: boolean;
          is_admin: boolean;
          is_suspended: boolean;
          suspended_reason: string | null;
          suspended_at: string | null;
          followers_count: number;
          following_count: number;
          posts_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          caption: string | null;
          media_urls: string[];
          post_type: 'text' | 'image' | 'video';
          visibility: 'public' | 'followers' | 'private';
          location_tag: string | null;
          likes_count: number;
          comments_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['posts']['Row'], 'id' | 'created_at' | 'likes_count' | 'comments_count'>;
        Update: Partial<Database['public']['Tables']['posts']['Insert']>;
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          parent_id: string | null;
          body: string;
          likes_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at' | 'likes_count'>;
        Update: Partial<Database['public']['Tables']['comments']['Insert']>;
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          target_type: 'post' | 'comment';
          target_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['likes']['Row'], 'id' | 'created_at'>;
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          status: 'pending' | 'accepted';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['follows']['Row'], 'id' | 'created_at'>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          sender_id: string;
          type: 'like' | 'comment' | 'follow' | 'follow_request' | 'mention';
          target_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          body: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          max_uses: number;
          times_used: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['promo_codes']['Row'], 'id' | 'created_at' | 'times_used'>;
        Update: Partial<Database['public']['Tables']['promo_codes']['Insert']>;
      };
      promo_redemptions: {
        Row: {
          id: string;
          user_id: string;
          promo_code_id: string;
          redeemed_at: string;
        };
        Insert: Omit<Database['public']['Tables']['promo_redemptions']['Row'], 'id' | 'redeemed_at'>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          status: 'free' | 'active' | 'expired' | 'cancelled' | 'suspended';
          plan: 'free' | 'monthly';
          amount_paid: number;
          currency: string;
          payment_provider: string | null;
          payment_reference: string | null;
          starts_at: string | null;
          expires_at: string | null;
          activated_by_promo_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          currency: string;
          status: 'pending' | 'success' | 'failed' | 'refunded';
          payment_provider: string;
          paystack_reference: string | null;
          paystack_authorization_url: string | null;
          paystack_access_code: string | null;
          paystack_channel: string | null;
          paystack_paid_at: string | null;
          metadata: any;
          subscription_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      admin_actions: {
        Row: {
          id: string;
          admin_id: string;
          action_type: string;
          target_user_id: string | null;
          details: any;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['admin_actions']['Row'], 'id' | 'created_at'>;
      };
    };
  };
};
