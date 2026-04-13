export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  avatar_data: AvatarData;
  total_playtime: number;
  nexacoins: number;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarData {
  body_color?: string;
  head_color?: string;
  shirt_color?: string;
  pants_color?: string;
  accessory?: string;
}

export interface Game {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  genre: string;
  max_players: number;
  is_published: boolean;
  is_featured: boolean;
  visit_count: number;
  like_count: number;
  dislike_count: number;
  active_players: number;
  scene_data: SceneData;
  settings: GameSettings;
  scripts: ScriptEntry[];
  version: number;
  created_at: string;
  updated_at: string;
  creator?: Profile;
}

export interface SceneData {
  objects: SceneObject[];
  terrain: TerrainData;
  lighting: LightingSettings;
  spawn_points?: SpawnPoint[];
}

export interface SceneObject {
  id: string;
  name: string;
  type: 'Part' | 'Model' | 'Light' | 'SpawnPoint' | 'Script' | 'Billboard' | 'Decal' | 'SpecialMesh';
  parent_id: string | null;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  properties: Record<string, unknown>;
  children?: string[];
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TerrainData {
  size?: Vector3;
  heightmap?: number[][];
  material?: string;
}

export interface LightingSettings {
  ambient?: number;
  sun_angle?: number;
  fog_start?: number;
  fog_end?: number;
  sky_color?: string;
}

export interface SpawnPoint {
  position: Vector3;
  rotation?: Vector3;
}

export interface GameSettings {
  gravity: number;
  ambient_light: number;
  max_fps?: number;
  respawn_time?: number;
}

export interface ScriptEntry {
  id: string;
  name: string;
  source: string;
  script_type: 'ServerScript' | 'LocalScript' | 'ModuleScript';
  enabled: boolean;
  object_id?: string;
}

export interface GameServer {
  id: string;
  game_id: string;
  region: string;
  status: 'starting' | 'running' | 'full' | 'stopping';
  current_players: number;
  max_players: number;
  channel_id: string;
  started_at: string;
  last_heartbeat: string;
  game?: Game;
}

export interface Wallet {
  id: string;
  user_id: string;
  nexacoins: number;
  nexagems: number;
  total_earned: number;
  total_spent: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  amount: number;
  currency: string;
  transaction_type: string;
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  asset_id?: string;
  title: string;
  description: string;
  thumbnail_url: string;
  item_type: string;
  price: number;
  currency: string;
  is_active: boolean;
  total_sales: number;
  created_at: string;
  seller?: Profile;
}

export interface Asset {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  asset_type: 'model' | 'texture' | 'audio' | 'script' | 'animation';
  thumbnail_url: string;
  asset_url: string;
  asset_data: Record<string, unknown>;
  file_size: number;
  is_public: boolean;
  is_approved: boolean;
  download_count: number;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id_1: string;
  user_id_2: string;
  created_at: string;
  friend?: Profile;
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  from_user?: Profile;
  to_user?: Profile;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender?: Profile;
}

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  member_count: number;
  is_public: boolean;
  created_at: string;
  owner?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface UserPresence {
  user_id: string;
  status: 'online' | 'in-game' | 'away' | 'offline';
  current_game_id?: string;
  last_seen: string;
}

export type AppPage =
  | 'hub'
  | 'studio'
  | 'game'
  | 'marketplace'
  | 'social'
  | 'profile'
  | 'settings'
  | 'server-browser';

export interface PlayerState {
  id: string;
  username: string;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  health: number;
  max_health: number;
  is_jumping: boolean;
  animation_state: string;
  avatar_data: AvatarData;
}

export interface ReplicationPacket {
  type: 'state_update' | 'remote_event' | 'remote_function' | 'chat' | 'join' | 'leave' | 'spawn';
  sequence: number;
  timestamp: number;
  sender_id: string;
  data: unknown;
}
