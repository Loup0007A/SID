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
  is_muted: boolean;
  reputation: number;
  last_seen_at: string | null;
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
  | "entreprise";

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
export type ContractType =
  | "tuer"
  | "chasse"
  | "raid"
  | "autres"
  | "missions_exterieures"
  | "espionnage"
  | "politique_x"
  | "collecte_vol";

export interface Quest {
  id: string;
  title: string;
  description: string | null;
  reward: number;
  difficulty: QuestDifficulty;
  contract_type: ContractType;
  deadline: string | null;
  status: QuestStatus;
  visibility: QuestVisibility;
  max_participants: number | null;
  assigned_group_id: string | null;
  funded_by_creator: boolean;
  pending_expiry_confirmation: boolean;
  reputation_reward: number | null;
  place_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface QuestParticipant {
  quest_id: string;
  user_id: string;
  status: "assigned" | "submitted" | "validated" | "rejected";
  reward_recipient_id: string | null;
  joined_at: string;
}

export interface QuestParticipantView {
  user_id: string;
  nickname: string;
  status: "assigned" | "submitted" | "validated" | "rejected";
  reward_recipient_id: string | null;
  reward_recipient_nickname: string | null;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  sale_ends_at: string | null;
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
  debt_principal: number;
  last_debt_interest_at: string | null;
}

export interface BankAccount {
  user_id: string;
  balance: number;
  last_interest_at: string;
  created_at: string;
}

export interface ChatChannel {
  id: string;
  type: "dm" | "group" | "application";
  name: string | null;
  related_application_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  edited_at: string | null;
  is_deleted: boolean;
  is_bold: boolean;
  is_italic: boolean;
  color: string | null;
  created_at: string;
}

export interface DmPartner {
  channel_id: string;
  partner_id: string;
  partner_nickname: string;
}

export type SalaryFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export interface SalaryView {
  user_id: string;
  nickname: string;
  amount: number;
  frequency: SalaryFrequency;
  is_active: boolean;
  next_payment_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  nickname: string;
  balance: number;
  reputation: number;
  quests_completed: number;
}
