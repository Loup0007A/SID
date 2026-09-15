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
}
