## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `first_name` | `text` |  |
| `last_name` | `text` |  |
| `nickname` | `text` |  |
| `weapons` | `text` |  Nullable |
| `equipment` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `age` | `int4` |  Nullable |
| `avatar_url` | `text` |  Nullable |
| `desired_role` | `text` |  Nullable |
| `status` | `text` |  |
| `is_founder` | `bool` |  |
| `hidden_fields` | `_text` |  |
| `reviewed_by` | `uuid` |  Nullable |
| `reviewed_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `member_rank` | `text` |  |
| `is_muted` | `bool` |  |
| `reputation` | `int4` |  |
| `last_seen_at` | `timestamptz` |  Nullable |
| `power_score` | `numeric` |  |
| `is_frozen` | `bool` |  |
| `freeze_until` | `timestamptz` |  Nullable |
| `mute_until` | `timestamptz` |  Nullable |
| `ban_until` | `timestamptz` |  Nullable |
| `is_invisible` | `bool` |  |
| `sandbox_expires_at` | `timestamptz` |  Nullable |
| `terms_version` | `text` |  Nullable |
| `terms_accepted_at` | `timestamptz` |  Nullable |
| `equipped_title` | `text` |  Nullable |
| `presence_visible` | `bool` |  |
| `activity_visible` | `bool` |  |

## Table `roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  Unique |
| `description` | `text` |  Nullable |
| `color` | `text` |  |
| `rank` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `role_permissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `role_id` | `uuid` | Primary |
| `permission` | `text` | Primary |

## Table `user_roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `role_id` | `uuid` | Primary |
| `assigned_at` | `timestamptz` |  |

## Table `groups`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `type` | `text` |  |
| `is_independent_system` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `group_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `group_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `role_in_group` | `text` |  Nullable |
| `joined_at` | `timestamptz` |  |

## Table `org_nodes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `label` | `text` |  |
| `parent_id` | `uuid` |  Nullable |
| `holder_id` | `uuid` |  Nullable |
| `group_id` | `uuid` |  Nullable |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `quests`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `reward` | `numeric` |  |
| `difficulty` | `text` |  |
| `deadline` | `timestamptz` |  Nullable |
| `status` | `text` |  |
| `visibility` | `text` |  |
| `max_participants` | `int4` |  Nullable |
| `assigned_group_id` | `uuid` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `contract_type` | `text` |  |
| `place_id` | `uuid` |  Nullable |
| `funded_by_creator` | `bool` |  |
| `pending_expiry_confirmation` | `bool` |  |
| `reputation_reward` | `int4` |  Nullable |
| `min_intelligence` | `numeric` |  |
| `min_strength` | `numeric` |  |
| `min_technique` | `numeric` |  |
| `min_power` | `numeric` |  |

## Table `quest_participants`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `quest_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `status` | `text` |  |
| `joined_at` | `timestamptz` |  |
| `reward_recipient_id` | `uuid` |  Nullable |

## Table `wallets`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `balance` | `numeric` |  |
| `debt_principal` | `numeric` |  |
| `last_debt_interest_at` | `timestamptz` |  Nullable |

## Table `transactions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `amount` | `numeric` |  |
| `reason` | `text` |  Nullable |
| `related_quest_id` | `uuid` |  Nullable |
| `related_purchase_id` | `uuid` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `shop_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `price` | `numeric` |  |
| `stock` | `int4` |  Nullable |
| `image_url` | `text` |  Nullable |
| `visibility` | `text` |  |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `sale_price` | `numeric` |  Nullable |
| `sale_ends_at` | `timestamptz` |  Nullable |
| `business_id` | `uuid` |  Nullable |
| `effect` | `text` |  Nullable |
| `hidden_at` | `timestamptz` |  Nullable |

## Table `purchases`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `item_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `quantity` | `int4` |  |
| `total_price` | `numeric` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `chat_channels`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `type` | `text` |  |
| `name` | `text` |  Nullable |
| `related_application_id` | `uuid` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `chat_participants`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `channel_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `joined_at` | `timestamptz` |  |
| `last_read_at` | `timestamptz` |  Nullable |

## Table `chat_messages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `channel_id` | `uuid` |  |
| `sender_id` | `uuid` |  |
| `content` | `text` |  |
| `created_at` | `timestamptz` |  |
| `edited_at` | `timestamptz` |  Nullable |
| `is_deleted` | `bool` |  |
| `is_bold` | `bool` |  |
| `is_italic` | `bool` |  |
| `color` | `text` |  Nullable |
| `troll_tag` | `jsonb` |  Nullable |

## Table `salaries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `amount` | `numeric` |  |
| `frequency` | `text` |  |
| `is_active` | `bool` |  |
| `next_payment_at` | `timestamptz` |  |
| `created_by` | `uuid` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `map_zones`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `type` | `text` |  |
| `color` | `text` |  |
| `path_points` | `jsonb` |  |
| `description` | `text` |  Nullable |
| `image_url` | `text` |  Nullable |
| `z_index` | `int4` |  |
| `is_published` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `controlling_group_id` | `uuid` |  Nullable |
| `texture_id` | `text` |  Nullable |

## Table `map_places`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `zone_id` | `uuid` |  Nullable |
| `name` | `text` |  |
| `type` | `text` |  |
| `x` | `numeric` |  |
| `y` | `numeric` |  |
| `icon` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `image_url` | `text` |  Nullable |
| `is_published` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `shape` | `text` |  |
| `radius` | `numeric` |  |
| `width` | `numeric` |  Nullable |
| `height` | `numeric` |  Nullable |
| `controlling_group_id` | `uuid` |  Nullable |
| `is_building` | `bool` |  |
| `allows_black_market` | `bool` |  |

## Table `map_comments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `target_type` | `text` |  |
| `target_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `content` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `city_districts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `city_id` | `uuid` |  |
| `name` | `text` |  |
| `color` | `text` |  |
| `path_points` | `jsonb` |  |
| `description` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `city_buildings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `city_id` | `uuid` |  |
| `district_id` | `uuid` |  Nullable |
| `type` | `text` |  |
| `name` | `text` |  Nullable |
| `x` | `numeric` |  |
| `y` | `numeric` |  |
| `width` | `numeric` |  |
| `height` | `numeric` |  |
| `rotation` | `numeric` |  |
| `description` | `text` |  Nullable |
| `image_url` | `text` |  Nullable |
| `owner_id` | `uuid` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `shape` | `text` |  |

## Table `building_floors`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `building_id` | `uuid` |  Nullable |
| `floor_number` | `int4` |  |
| `name` | `text` |  Nullable |
| `plan_data` | `jsonb` |  |
| `description` | `text` |  Nullable |
| `image_url` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `place_id` | `uuid` |  Nullable |

## Table `map_icon_config`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `category` | `text` | Primary |
| `key` | `text` | Primary |
| `label` | `text` |  |
| `icon` | `text` |  |
| `sort_order` | `int4` |  |
| `is_custom` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `map_routes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  Nullable |
| `from_place_id` | `uuid` |  Nullable |
| `to_place_id` | `uuid` |  Nullable |
| `path_points` | `jsonb` |  |
| `color` | `text` |  |
| `travel_minutes` | `int4` |  Nullable |
| `is_published` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `character_positions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `place_id` | `uuid` |  Nullable |
| `building_id` | `uuid` |  Nullable |
| `route_id` | `uuid` |  Nullable |
| `route_progress` | `numeric` |  Nullable |
| `note` | `text` |  Nullable |
| `is_visible` | `bool` |  |
| `updated_at` | `timestamptz` |  |
| `travel_started_at` | `timestamptz` |  Nullable |
| `planned_path` | `jsonb` |  Nullable |
| `spawned` | `bool` |  |
| `status` | `text` |  Nullable |
| `arrived_at` | `timestamptz` |  Nullable |
| `travel_duration_minutes` | `numeric` |  Nullable |
| `flight_target_place_id` | `uuid` |  Nullable |
| `active_mount_id` | `uuid` |  Nullable |
| `mount_expires_at` | `timestamptz` |  Nullable |

## Table `activity_log`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `day` | `date` | Primary |
| `visits` | `int4` |  |

## Table `notifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `type` | `text` |  |
| `title` | `text` |  |
| `body` | `text` |  Nullable |
| `link` | `text` |  Nullable |
| `count` | `int4` |  |
| `is_read` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `push_subscriptions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `endpoint` | `text` |  Unique |
| `p256dh` | `text` |  |
| `auth` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `app_config`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `text` | Primary |
| `value` | `text` |  Nullable |

## Table `bank_accounts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `balance` | `numeric` |  |
| `last_interest_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |

## Table `businesses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `founder_id` | `uuid` |  |
| `treasury_balance` | `numeric` |  |
| `debt_principal` | `numeric` |  |
| `last_debt_interest_at` | `timestamptz` |  Nullable |
| `share_count` | `int4` |  |
| `shares_in_treasury` | `int4` |  |
| `share_price` | `numeric` |  |
| `created_at` | `timestamptz` |  |
| `is_closed` | `bool` |  |
| `initial_valuation` | `numeric` |  Nullable |
| `last_share_growth_at` | `timestamptz` |  Nullable |
| `demand_shares` | `int4` |  |
| `last_issue_check_at` | `timestamptz` |  Nullable |

## Table `business_shareholders`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `business_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `quantity` | `int4` |  |

## Table `business_share_price_history`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `price` | `numeric` |  |
| `recorded_at` | `timestamptz` |  |

## Table `business_transactions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `amount` | `numeric` |  |
| `reason` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `kind` | `text` |  Nullable |

## Table `tax_pool`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `bool` | Primary |
| `balance` | `numeric` |  |
| `last_distributed_at` | `timestamptz` |  |

## Table `business_employees`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `business_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `title` | `text` |  Nullable |
| `salary` | `numeric` |  |
| `frequency` | `text` |  |
| `next_payment_at` | `timestamptz` |  |
| `hired_at` | `timestamptz` |  |

## Table `power_score_log`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `old_score` | `int4` |  |
| `new_score` | `int4` |  |
| `changed_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `maintenance_flags`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `text` | Primary |
| `is_enabled` | `bool` |  |
| `message` | `text` |  Nullable |
| `updated_by` | `uuid` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `business_share_lots`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `quantity` | `int4` |  |
| `bought_at` | `timestamptz` |  |

## Table `announcements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `title` | `text` |  |
| `body` | `text` |  |
| `severity` | `text` |  |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `announcement_reads`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `announcement_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `read_at` | `timestamptz` |  |

## Table `sanctions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `type` | `text` |  |
| `reason` | `text` |  Nullable |
| `amount` | `numeric` |  Nullable |
| `issued_by` | `uuid` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `profile_styles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `section` | `text` | Primary |
| `css` | `text` |  |
| `updated_at` | `timestamptz` |  |

## Table `wiki_entries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `category` | `text` |  |
| `number` | `int4` |  |
| `title` | `text` |  |
| `summary` | `text` |  |
| `content` | `text` |  |
| `image_url` | `text` |  Nullable |
| `tags` | `_text` |  |
| `discovered` | `bool` |  |
| `discovered_at` | `timestamptz` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `discovered_by` | `uuid` |  Nullable |
| `rarity` | `int2` |  Nullable |
| `infobox` | `jsonb` |  |
| `model_url` | `text` |  Nullable |
| `model_animation` | `text` |  Nullable |
| `gear_shape` | `text` |  Nullable |
| `gear_color` | `text` |  Nullable |
| `gear_dx` | `int4` |  |
| `gear_dy` | `int4` |  |
| `gear_scale` | `numeric` |  |
| `gear_rot` | `int4` |  |
| `gear_placement` | `jsonb` |  |

## Table `wiki_entry_links`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `from_id` | `uuid` | Primary |
| `to_id` | `uuid` | Primary |

## Table `sim_agents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `first_name` | `text` |  |
| `last_name` | `text` |  |
| `age` | `int4` |  |
| `sex` | `text` |  |
| `wealth_class` | `text` |  |
| `weekly_salary` | `numeric` |  |
| `balance` | `numeric` |  |
| `luck` | `int4` |  |
| `ambition` | `int4` |  |
| `can_have_children` | `bool` |  |
| `mood` | `text` |  |
| `mood_day` | `date` |  |
| `partner_id` | `uuid` |  Nullable |
| `parent_a_id` | `uuid` |  Nullable |
| `parent_b_id` | `uuid` |  Nullable |
| `created_on_day` | `date` |  |
| `created_at` | `timestamptz` |  |

## Table `sim_shareholdings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `agent_id` | `uuid` | Primary |
| `business_id` | `uuid` | Primary |
| `quantity` | `int4` |  |

## Table `sim_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `day` | `date` |  |
| `kind` | `text` |  |
| `agent_id` | `uuid` |  Nullable |
| `amount` | `numeric` |  Nullable |
| `detail` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `sim_state`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `bool` | Primary |
| `last_processed_day` | `date` |  Nullable |
| `population_cap` | `int4` |  |

## Table `mount_types`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `icon` | `text` |  |
| `speed_multiplier` | `numeric` |  |
| `can_fly` | `bool` |  |
| `rental_price` | `numeric` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `flight_speed_kmh` | `numeric` |  Nullable |
| `flight_range_km` | `numeric` |  Nullable |
| `rental_hours` | `numeric` |  |
| `allowed_biomes` | `_text` |  Nullable |

## Table `mount_rentals`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `place_id` | `uuid` |  |
| `mount_type_id` | `uuid` |  |
| `price_override` | `numeric` |  Nullable |
| `stock` | `int4` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `map_relief`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `path_points` | `jsonb` |  |
| `elevation` | `numeric` |  |
| `is_published` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `texture_id` | `text` |  Nullable |

## Table `map_biomes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `path_points` | `jsonb` |  |
| `biome_type` | `text` |  |
| `color` | `text` |  |
| `is_published` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `texture_id` | `text` |  Nullable |

## Table `wiki_comments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `entry_id` | `uuid` |  |
| `author_id` | `uuid` |  |
| `body` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `wiki_favorites`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `entry_id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |

## Table `wiki_revisions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `entry_id` | `uuid` |  |
| `title` | `text` |  |
| `summary` | `text` |  |
| `content` | `text` |  |
| `tags` | `_text` |  |
| `infobox` | `jsonb` |  |
| `edited_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `black_market_stalls`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `place_id` | `uuid` |  |
| `owner_id` | `uuid` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `black_market_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `stall_id` | `uuid` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `price` | `numeric` |  |
| `stock` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `black_market_sales`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `item_id` | `uuid` |  Nullable |
| `stall_id` | `uuid` |  Nullable |
| `buyer_id` | `uuid` |  |
| `seller_id` | `uuid` |  |
| `item_name` | `text` |  |
| `quantity` | `int4` |  |
| `total_price` | `numeric` |  |
| `admin_fee` | `numeric` |  |
| `created_at` | `timestamptz` |  |

## Table `teleport_crystals`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `label` | `text` |  |
| `from_place_id` | `uuid` |  |
| `to_place_id` | `uuid` |  |
| `holder_id` | `uuid` |  |
| `is_single_use` | `bool` |  |
| `used_at` | `timestamptz` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `map_textures`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `motif` | `text` |  |
| `glyph` | `text` |  Nullable |
| `color` | `text` |  |
| `bg` | `text` |  Nullable |
| `size` | `numeric` |  |
| `opacity` | `numeric` |  |
| `rotation` | `numeric` |  |
| `stagger` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `drawing` | `jsonb` |  Nullable |
| `bg_opacity` | `numeric` |  |

## Table `wiki_notes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `entry_id` | `uuid` | Primary |
| `body` | `text` |  |
| `updated_at` | `timestamptz` |  |

## Table `wiki_reports`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `entry_id` | `uuid` |  |
| `author_id` | `uuid` |  |
| `kind` | `text` |  |
| `body` | `text` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `resolved_at` | `timestamptz` |  Nullable |

## Table `wiki_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `text` | Primary |
| `value` | `text` |  |
| `updated_at` | `timestamptz` |  |

## Table `map_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `km_per_unit` | `numeric` |  |
| `walk_kmh` | `numeric` |  |
| `unit_label` | `text` |  |
| `updated_at` | `timestamptz` |  |
| `world_size` | `numeric` |  |

## Table `mount_rental_log`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `mount_type_id` | `uuid` |  Nullable |
| `place_id` | `uuid` |  Nullable |
| `price` | `numeric` |  |
| `admin_share` | `numeric` |  |
| `rented_at` | `timestamptz` |  |
| `expires_at` | `timestamptz` |  Nullable |

## Table `audit_log`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `created_at` | `timestamptz` |  |
| `actor_id` | `uuid` |  Nullable |
| `actor_nickname` | `text` |  Nullable |
| `action` | `text` |  |
| `target_user_id` | `uuid` |  Nullable |
| `target_label` | `text` |  Nullable |
| `details` | `jsonb` |  |

## Table `wiki_profile_gear`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `slot` | `text` | Primary |
| `entry_id` | `uuid` |  |
| `updated_by` | `uuid` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `member_stats`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `intelligence` | `numeric` |  |
| `strength` | `numeric` |  |
| `technique` | `numeric` |  |
| `updated_at` | `timestamptz` |  |

## Table `power_score_legacy`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `power_score` | `int4` |  |
| `saved_at` | `timestamptz` |  |

## Table `simulation_runs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `kind` | `text` |  |
| `token_hash` | `text` |  Unique |
| `status` | `text` |  |
| `points_awarded` | `int4` |  |
| `started_at` | `timestamptz` |  |
| `finished_at` | `timestamptz` |  Nullable |
| `expires_at` | `timestamptz` |  |
| `skill` | `text` |  Nullable |

## Table `simulation_progress`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `kind` | `text` | Primary |
| `data` | `jsonb` |  |
| `updated_at` | `timestamptz` |  |

## Table `member_skills`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `skill` | `text` | Primary |
| `points` | `int4` |  |
| `updated_at` | `timestamptz` |  |

## Table `member_consumables`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `effect` | `text` | Primary |
| `quantity` | `int4` |  |

## Table `boss_raids`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `host_id` | `uuid` |  |
| `story` | `int4` |  |
| `chapter` | `int4` |  |
| `boss_name` | `text` |  |
| `dragon` | `bool` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `expires_at` | `timestamptz` |  |
| `finished_at` | `timestamptz` |  Nullable |

## Table `boss_raid_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `raid_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `joined_at` | `timestamptz` |  |

## Table `simulation_injuries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `kind` | `text` | Primary |
| `until` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |

## Table `tech_nodes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `text` | Primary |
| `label` | `text` |  |
| `description` | `text` |  |
| `emoji` | `text` |  |
| `branch` | `text` |  |
| `max_level` | `int4` |  |
| `cost_base` | `int4` |  |
| `cost_step` | `int4` |  |
| `effect_pct` | `numeric` |  |
| `requires_key` | `text` |  Nullable |
| `requires_level` | `int4` |  |
| `sort` | `int4` |  |

## Table `member_tech`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `node` | `text` | Primary |
| `level` | `int4` |  |

## Table `tech_purchases`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `node` | `text` |  |
| `level` | `int4` |  |
| `cost` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `sandbox_accounts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `created_by` | `uuid` |  Nullable |
| `email` | `text` |  |
| `permissions` | `_text` |  |
| `expires_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |

## Table `activity_alerts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `user_id` | `uuid` |  Nullable |
| `kind` | `text` |  |
| `severity` | `text` |  |
| `title` | `text` |  |
| `details` | `jsonb` |  |
| `dedupe_key` | `text` |  Unique |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `handled_by` | `uuid` |  Nullable |
| `handled_at` | `timestamptz` |  Nullable |

## Table `privacy_requests`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `user_id` | `uuid` |  |
| `kind` | `text` |  |
| `reason` | `text` |  Nullable |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `handled_by` | `uuid` |  Nullable |
| `handled_at` | `timestamptz` |  Nullable |
| `note` | `text` |  Nullable |

## Table `titles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `power` | `text` |  |
| `max_level` | `int4` |  |
| `sort` | `int4` |  |
| `event` | `text` |  Nullable |

## Table `user_titles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `title_id` | `text` | Primary |
| `level` | `int4` |  |
| `source` | `text` |  Nullable |
| `obtained_at` | `timestamptz` |  |
| `upgraded_at` | `timestamptz` |  Nullable |
| `seen_at` | `timestamptz` |  Nullable |

## Table `title_progress`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `key` | `text` | Primary |
| `value` | `numeric` |  |
| `data` | `jsonb` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `title_challenges`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `kind` | `text` |  |
| `created_at` | `timestamptz` |  |
| `expires_at` | `timestamptz` |  |
| `used_at` | `timestamptz` |  Nullable |

## Table `hidden_buttons`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `path` | `text` |  |
| `x` | `numeric` |  |
| `y` | `numeric` |  |
| `created_at` | `timestamptz` |  |
| `found_at` | `timestamptz` |  Nullable |

## Table `member_birthdays`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `day` | `int2` |  |
| `month` | `int2` |  |
| `updated_at` | `timestamptz` |  |

## Table `birthday_gifts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `giver_id` | `uuid` |  |
| `receiver_id` | `uuid` |  |
| `year` | `int4` |  |
| `amount` | `numeric` |  |
| `created_at` | `timestamptz` |  |

## Table `troll_actions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `power` | `text` |  |
| `title_id` | `text` |  |
| `level` | `int4` |  |
| `actor_id` | `uuid` |  |
| `target_id` | `uuid` |  Nullable |
| `params` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `ends_at` | `timestamptz` |  |
| `cancelled_at` | `timestamptz` |  Nullable |
| `cancelled_by` | `uuid` |  Nullable |
| `result` | `jsonb` |  Nullable |

## Table `troll_responses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `troll_id` | `int8` | Primary |
| `user_id` | `uuid` | Primary |
| `result` | `text` |  |
| `details` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `troll_shields`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `set_by` | `uuid` |  Nullable |
| `reason` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `presence`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `page` | `text` |  |
| `extra` | `text` |  Nullable |
| `idle` | `bool` |  |
| `online_since` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `left_at` | `timestamptz` |  Nullable |

## Table `envers_config`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `x` | `numeric` |  |
| `y` | `numeric` |  |
| `radius` | `numeric` |  |
| `km_multiplier` | `numeric` |  |
| `session_hours` | `numeric` |  |
| `access_minutes` | `numeric` |  |
| `probe_gap_seconds` | `numeric` |  |
| `probes_per_hour` | `int4` |  |
| `is_open` | `bool` |  |
| `moved_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `envers_stays`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `inside` | `bool` |  |
| `entered_at` | `timestamptz` |  Nullable |
| `last_tick_at` | `timestamptz` |  Nullable |
| `ends_at` | `timestamptz` |  Nullable |
| `speed_kmh` | `numeric` |  |
| `session_km` | `numeric` |  |
| `km_total` | `numeric` |  |
| `first_found_at` | `timestamptz` |  Nullable |
| `last_found_at` | `timestamptz` |  Nullable |
| `found_count` | `int4` |  |
| `last_probe_at` | `timestamptz` |  Nullable |
| `probe_window_start` | `timestamptz` |  Nullable |
| `probe_window_count` | `int4` |  |

## Table `envers_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `price` | `numeric` |  |
| `stock` | `int4` |  Nullable |
| `is_active` | `bool` |  |
| `sort` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `envers_sales`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `item_id` | `uuid` |  Nullable |
| `buyer_id` | `uuid` |  |
| `item_name` | `text` |  |
| `quantity` | `int4` |  |
| `total_price` | `numeric` |  |
| `created_at` | `timestamptz` |  |

## Table `onboarding`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `briefing_seen_at` | `timestamptz` |  Nullable |
| `tour_step` | `int4` |  |
| `tour_done_at` | `timestamptz` |  Nullable |
| `tour_skipped_at` | `timestamptz` |  Nullable |
| `tips_seen` | `_text` |  |
| `reward_claimed_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `reputation_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `delta` | `int4` |  |
| `reason` | `text` |  |
| `quest_id` | `uuid` |  Nullable |
| `actor_id` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## RLS Policies

### `tech_nodes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `tech_nodes_select` | SELECT | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | — |

### `tax_pool`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `tax_pool_select` | SELECT | public | PERMISSIVE | `(has_permission(auth.uid(), 'manage_economy'::text) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `power_score_log`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `power_score_log_select` | SELECT | public | PERMISSIVE | `(has_permission(auth.uid(), 'manage_users'::text) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `wiki_comments`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `wiki_comments_admin_all` | ALL | public | PERMISSIVE | `wiki_is_admin()` | `wiki_is_admin()` |

### `map_textures`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_textures_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_textures_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `profiles_select` | SELECT | public | PERMISSIVE | `((auth.uid() = id) OR has_permission(auth.uid(), 'manage_users'::text) OR has_permission(auth.uid(), 'recruit'::text) OR (status = 'active'::text))` | — |
| `profiles_update_self` | UPDATE | public | PERMISSIVE | `(auth.uid() = id)` | `(auth.uid() = id)` |
| `profiles_update_staff` | UPDATE | public | PERMISSIVE | `(has_permission(auth.uid(), 'manage_users'::text) OR has_permission(auth.uid(), 'recruit'::text))` | — |

### `roles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `roles_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_roles'::text)` | `has_permission(auth.uid(), 'manage_roles'::text)` |
| `roles_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `user_roles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `user_roles_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_roles'::text)` | `has_permission(auth.uid(), 'manage_roles'::text)` |
| `user_roles_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `role_permissions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `role_permissions_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_roles'::text)` | `has_permission(auth.uid(), 'manage_roles'::text)` |
| `role_permissions_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `business_share_lots`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `business_share_lots_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR (EXISTS ( SELECT 1    FROM businesses b   WHERE ((b.id = business_share_lots.business_id) AND (b.founder_id = auth.uid())))) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `maintenance_flags`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `maintenance_flags_select` | SELECT | public | PERMISSIVE | `true` | — |

### `groups`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `groups_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_teams'::text)` | `has_permission(auth.uid(), 'manage_teams'::text)` |
| `groups_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `group_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `group_members_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_teams'::text)` | `has_permission(auth.uid(), 'manage_teams'::text)` |
| `group_members_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `org_nodes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `org_nodes_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_org_chart'::text)` | `has_permission(auth.uid(), 'manage_org_chart'::text)` |
| `org_nodes_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `transactions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `transactions_insert` | INSERT | public | PERMISSIVE | — | `has_permission(auth.uid(), 'manage_economy'::text)` |
| `transactions_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `purchases`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `purchases_insert` | INSERT | public | PERMISSIVE | — | `(user_id = auth.uid())` |
| `purchases_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_shop'::text))` | — |
| `purchases_update_staff` | UPDATE | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_shop'::text)` | — |

### `chat_participants`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `chat_participants_insert` | INSERT | public | PERMISSIVE | — | `((user_id = auth.uid()) OR (EXISTS ( SELECT 1    FROM chat_channels c   WHERE ((c.id = chat_participants.channel_id) AND (c.created_by = auth.uid())))) OR ((EXISTS ( SELECT 1    FROM chat_channels c   WHERE ((c.id = chat_participants.channel_id) AND (c.type = 'group'::text)))) AND is_channel_participant(channel_id, auth.uid())))` |
| `chat_participants_select` | SELECT | public | PERMISSIVE | `is_channel_participant(channel_id, auth.uid())` | — |

### `wallets`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `wallets_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_economy'::text)` | `has_permission(auth.uid(), 'manage_economy'::text)` |
| `wallets_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `quest_participants`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `quest_participants_delete` | DELETE | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_quests'::text))` | — |
| `quest_participants_join` | INSERT | public | PERMISSIVE | — | `(((user_id = auth.uid()) AND (NOT COALESCE(( SELECT profiles.is_frozen    FROM profiles   WHERE (profiles.id = auth.uid())), false)) AND is_feature_enabled('quests'::text)) OR has_permission(auth.uid(), 'manage_quests'::text))` |
| `quest_participants_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_quests'::text) OR (quest_created_by(quest_id) = auth.uid()))` | — |
| `quest_participants_update` | UPDATE | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_quests'::text))` | — |

### `chat_channels`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `chat_channels_insert` | INSERT | public | PERMISSIVE | — | `(created_by = auth.uid())` |
| `chat_channels_select` | SELECT | public | PERMISSIVE | `((created_by = auth.uid()) OR is_channel_participant(id, auth.uid()))` | — |

### `simulation_progress`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `simulation_progress_select` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `chat_messages`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `chat_messages_insert` | INSERT | public | PERMISSIVE | — | `((sender_id = auth.uid()) AND is_channel_participant(channel_id, auth.uid()) AND (NOT COALESCE(( SELECT profiles.is_muted    FROM profiles   WHERE (profiles.id = auth.uid())), false)) AND (NOT COALESCE(( SELECT profiles.is_frozen    FROM profiles   WHERE (profiles.id = auth.uid())), false)) AND is_feature_enabled('chat'::text))` |
| `chat_messages_select` | SELECT | public | PERMISSIVE | `is_channel_participant(channel_id, auth.uid())` | — |
| `chat_messages_update_own` | UPDATE | public | PERMISSIVE | `(sender_id = auth.uid())` | `(sender_id = auth.uid())` |

### `wiki_reports`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `wiki_reports_admin_all` | ALL | public | PERMISSIVE | `wiki_is_admin()` | `wiki_is_admin()` |

### `member_stats`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `member_stats_select` | SELECT | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | — |

### `announcement_reads`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `announcement_reads_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `announcements`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `announcements_select` | SELECT | public | PERMISSIVE | `true` | — |

### `sanctions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sanctions_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `wiki_revisions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `wiki_revisions_admin_select` | SELECT | public | PERMISSIVE | `wiki_is_admin()` | — |

### `character_positions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `character_positions_admin_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |
| `character_positions_select` | SELECT | authenticated | PERMISSIVE | `((is_visible = true) OR (user_id = auth.uid()))` | — |

### `map_routes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_routes_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_routes_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `wiki_entries`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `wiki_entries_admin_all` | ALL | public | PERMISSIVE | `wiki_is_admin()` | `wiki_is_admin()` |

### `wiki_entry_links`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `wiki_entry_links_admin_all` | ALL | public | PERMISSIVE | `wiki_is_admin()` | `wiki_is_admin()` |

### `business_employees`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `business_employees_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR (EXISTS ( SELECT 1    FROM businesses b   WHERE ((b.id = business_employees.business_id) AND (b.founder_id = auth.uid())))) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `profile_styles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `profile_styles_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `sim_agents`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sim_agents_select` | SELECT | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_economy'::text)` | — |

### `sim_shareholdings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sim_shareholdings_select` | SELECT | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_economy'::text)` | — |

### `sim_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sim_events_select` | SELECT | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_economy'::text)` | — |

### `mount_rentals`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `mount_rentals_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `mount_rentals_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `salaries`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `salaries_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_economy'::text)` | `has_permission(auth.uid(), 'manage_economy'::text)` |
| `salaries_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `member_skills`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `member_skills_select` | SELECT | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | — |

### `bank_accounts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `bank_accounts_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `mount_types`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `mount_types_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `mount_types_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `map_settings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_settings_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_settings_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `member_consumables`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `member_consumables_select` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `shop_items`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `shop_items_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_shop'::text)` | `has_permission(auth.uid(), 'manage_shop'::text)` |
| `shop_items_manage_own` | UPDATE | public | PERMISSIVE | `(created_by = auth.uid())` | `(created_by = auth.uid())` |
| `shop_items_select` | SELECT | public | PERMISSIVE | `(((visibility = 'public'::text) AND is_active) OR ((visibility = 'members'::text) AND (auth.uid() IS NOT NULL)) OR has_permission(auth.uid(), 'manage_shop'::text))` | — |

### `map_biomes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_biomes_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_biomes_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `map_relief`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_relief_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_relief_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `quests`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `quests_manage` | ALL | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_quests'::text)` | `has_permission(auth.uid(), 'manage_quests'::text)` |
| `quests_select` | SELECT | public | PERMISSIVE | `((visibility = 'public'::text) OR ((visibility = 'members'::text) AND (auth.uid() IS NOT NULL)) OR ((visibility = 'private'::text) AND ((created_by = auth.uid()) OR has_permission(auth.uid(), 'manage_quests'::text) OR is_quest_participant(id, auth.uid()))))` | — |

### `sim_state`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sim_state_select` | SELECT | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_economy'::text)` | — |

### `member_tech`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `member_tech_select` | SELECT | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | — |

### `tech_purchases`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `tech_purchases_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `mount_rental_log`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `mount_log_select` | SELECT | authenticated | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text))` | — |

### `activity_log`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `activity_log_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `troll_shields`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `troll_shields_select` | SELECT | authenticated | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `power_score_legacy`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `power_score_legacy_select` | SELECT | public | PERMISSIVE | `(has_permission(auth.uid(), 'manage_users'::text) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `map_zones`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_zones_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_zones_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `audit_log`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `audit_log_select` | SELECT | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_users'::text)` | — |

### `city_buildings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `city_buildings_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `city_buildings_update_owner` | UPDATE | authenticated | PERMISSIVE | `(owner_id = auth.uid())` | `(owner_id = auth.uid())` |
| `city_buildings_write_admin` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `map_comments`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_comments_delete_admin` | DELETE | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | — |
| `map_comments_delete_own` | DELETE | authenticated | PERMISSIVE | `(user_id = auth.uid())` | — |
| `map_comments_insert` | INSERT | authenticated | PERMISSIVE | — | `(user_id = auth.uid())` |
| `map_comments_select` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `city_districts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `city_districts_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `city_districts_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `notifications`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `notifications_select` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |
| `notifications_update_own` | UPDATE | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `building_floors`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `building_floors_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `building_floors_write_admin` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |
| `building_floors_write_owner` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM city_buildings b   WHERE ((b.id = building_floors.building_id) AND (b.owner_id = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM city_buildings b   WHERE ((b.id = building_floors.building_id) AND (b.owner_id = auth.uid()))))` |

### `map_places`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_places_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_places_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `business_shareholders`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `business_shareholders_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `business_share_price_history`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `business_share_price_history_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `map_icon_config`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `map_icon_config_select` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `map_icon_config_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |

### `businesses`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `businesses_select_all` | SELECT | public | PERMISSIVE | `true` | — |

### `push_subscriptions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `push_subscriptions_own` | ALL | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `business_transactions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `business_transactions_select` | SELECT | public | PERMISSIVE | `((EXISTS ( SELECT 1    FROM businesses b   WHERE ((b.id = business_transactions.business_id) AND (b.founder_id = auth.uid())))) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `black_market_stalls`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `bm_stalls_delete` | DELETE | authenticated | PERMISSIVE | `((owner_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text))` | — |
| `bm_stalls_insert` | INSERT | authenticated | PERMISSIVE | — | `((owner_id = auth.uid()) AND (EXISTS ( SELECT 1    FROM map_places p   WHERE ((p.id = black_market_stalls.place_id) AND p.allows_black_market))) AND (EXISTS ( SELECT 1    FROM character_positions cp   WHERE ((cp.user_id = auth.uid()) AND (cp.place_id = black_market_stalls.place_id) AND (cp.travel_started_at IS NULL)))))` |
| `bm_stalls_read` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `bm_stalls_update` | UPDATE | authenticated | PERMISSIVE | `((owner_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text))` | `((owner_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text))` |

### `black_market_items`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `bm_items_read` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `bm_items_write` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM black_market_stalls s   WHERE ((s.id = black_market_items.stall_id) AND ((s.owner_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text)))))` | `(EXISTS ( SELECT 1    FROM black_market_stalls s   WHERE ((s.id = black_market_items.stall_id) AND ((s.owner_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text)))))` |

### `black_market_sales`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `bm_sales_read` | SELECT | authenticated | PERMISSIVE | `((buyer_id = auth.uid()) OR (seller_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text))` | — |

### `teleport_crystals`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `crystals_admin_write` | ALL | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_map'::text)` | `has_permission(auth.uid(), 'manage_map'::text)` |
| `crystals_read` | SELECT | authenticated | PERMISSIVE | `((holder_id = auth.uid()) OR has_permission(auth.uid(), 'manage_map'::text))` | — |

### `simulation_runs`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `simulation_runs_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

### `simulation_injuries`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `simulation_injuries_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `boss_raids`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `boss_raids_select` | SELECT | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | — |

### `boss_raid_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `boss_raid_members_select` | SELECT | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | — |

### `sandbox_accounts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sandbox_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `activity_alerts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `activity_alerts_select` | SELECT | public | PERMISSIVE | `has_permission(auth.uid(), 'manage_users'::text)` | — |

### `privacy_requests`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `privacy_requests_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `user_titles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `user_titles_select` | SELECT | authenticated | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text) OR (EXISTS ( SELECT 1    FROM profiles p   WHERE ((p.id = user_titles.user_id) AND (NOT COALESCE(p.is_invisible, false))))))` | — |

### `title_progress`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `title_progress_select_own` | SELECT | authenticated | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `titles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `titles_select` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `member_birthdays`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `member_birthdays_admin` | SELECT | authenticated | PERMISSIVE | `has_permission(auth.uid(), 'manage_users'::text)` | — |
| `member_birthdays_own` | ALL | authenticated | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `birthday_gifts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `birthday_gifts_select` | SELECT | authenticated | PERMISSIVE | `((giver_id = auth.uid()) OR (receiver_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `troll_actions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `troll_actions_select` | SELECT | authenticated | PERMISSIVE | `((actor_id = auth.uid()) OR (target_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `troll_responses`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `troll_responses_select` | SELECT | authenticated | PERMISSIVE | `((user_id = auth.uid()) OR (EXISTS ( SELECT 1    FROM troll_actions a   WHERE ((a.id = troll_responses.troll_id) AND (a.actor_id = auth.uid())))) OR has_permission(auth.uid(), 'manage_users'::text))` | — |

### `onboarding`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `onboarding_read_own` | SELECT | authenticated | PERMISSIVE | `(user_id = auth.uid())` | — |

### `reputation_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `reputation_events_read` | SELECT | authenticated | PERMISSIVE | `((user_id = auth.uid()) OR has_permission(auth.uid(), 'manage_users'::text) OR has_permission(auth.uid(), 'manage_economy'::text))` | — |

