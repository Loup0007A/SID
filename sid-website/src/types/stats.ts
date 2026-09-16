export interface AdminStats {
  total_members: number;
  active_members: number;
  pending_members: number;
  banned_members: number;
  active_today: number;
  visits_week: number;
  visits_month: number;
  messages_total: number;
  most_active_member: { nickname: string; message_count: number } | null;
  quests_created: number;
  quests_completed: number;
  purchases_count: number;
  purchases_total_value: number;
  peak_hour: number | null;
  streak_days: number;
  weekly_activity: { week_start: string; message_count: number }[];
  heatmap: { dow: number; hour: number; count: number }[];
  top_selling_item: { name: string; quantity: number } | null;
  top_buyer: { nickname: string; total_spent: number } | null;
  top_seller: { nickname: string; total_earned: number } | null;
  purchases_weekly: { week_start: string; purchases_count: number; total_value: number }[];
}
