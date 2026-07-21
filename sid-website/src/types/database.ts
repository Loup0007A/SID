export type ProfileStatus = "pending" | "active" | "rejected" | "banned";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  weapons: string | null;
  equipment: string | null;
  description: string | null;
  age: number | null;
  avatar_url: string | null;
  desired_role: string | null;
  status: ProfileStatus;
  is_founder: boolean;
  member_rank: QuestDifficulty;
  hidden_fields: string[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type PermissionKey =
  | "manage_roles"
  | "manage_org_chart"
  | "manage_quests"
  | "manage_shop"
  | "manage_teams"
  | "manage_economy"
  | "recruit"
  | "manage_users"
  | "manage_espionage";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  color: string;
  rank: number;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  type: "org_branch" | "quest_team" | "guild_team" | "other";
  is_independent_system: boolean;
  created_at: string;
}

export interface OrgNode {
  id: string;
  label: string;
  parent_id: string | null;
  holder_id: string | null;
  group_id: string | null;
  sort_order: number;
}

export type QuestDifficulty = "E" | "D" | "C" | "B" | "A" | "S";
export type QuestStatus = "open" | "in_progress" | "completed" | "failed" | "cancelled";
export type QuestVisibility = "public" | "members" | "private";

export interface Quest {
  id: string;
  title: string;
  description: string | null;
  reward: number;
  difficulty: QuestDifficulty;
  deadline: string | null;
  status: QuestStatus;
  visibility: QuestVisibility;
  max_participants: number | null;
  assigned_group_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface QuestParticipant {
  quest_id: string;
  user_id: string;
  status: "assigned" | "submitted" | "validated" | "rejected";
  joined_at: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  image_url: string | null;
  visibility: "public" | "members";
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Wallet {
  user_id: string;
  balance: number;
}

export interface ChatChannel {
  id: string;
  type: "dm" | "group" | "application";
  name: string | null;
  related_application_id: string | null;
  spy_eligible: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SpyRole {
  user_id: string;
  spy_level: 1 | 2 | 3;
  xp: number;
  last_spied_at: string | null;
  assigned_by: string | null;
  created_at: string;
}

export interface SpySnippet {
  content: string;
  sender_nickname: string;
  created_at: string;
}

export interface SpyReport {
  id: string;
  spy_id: string;
  channel_id: string;
  snippets: SpySnippet[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
