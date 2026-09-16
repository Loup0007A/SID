export type NotificationType =
  | "chat_message"
  | "quest_validated"
  | "application_decision"
  | "quest_confirmation_needed"
  | "travel_arrived"
  | "salary_paid";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  count: number;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}
