export type AnnouncementSeverity = "info" | "warning" | "critical";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface MaintenanceFlag {
  key: string;
  is_enabled: boolean;
  message: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type SanctionType = "warning" | "mute" | "freeze" | "ban" | "fine";

export interface Sanction {
  id: string;
  user_id: string;
  type: SanctionType;
  reason: string | null;
  amount: number | null;
  issued_by: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SanctionView extends Sanction {
  nickname: string;
  issued_by_nickname: string | null;
}
