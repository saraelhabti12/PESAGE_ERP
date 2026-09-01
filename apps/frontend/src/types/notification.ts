export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface AppNotification {
  id: number;
  user_id?: number | null;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link?: string | null;
  created_at: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}
