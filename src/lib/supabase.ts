import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type User = {
  id: string
  nickname: string
  password: string
  created_at: string
}

export type Room = {
  id: string
  code: string
  name: string
  goal_km: number
  penalty: string
  created_by: string
  admin_password: string
  created_at: string
}

export type RoomMember = {
  id: string
  room_id: string
  user_id: string
  display_name: string
  joined_at: string
}

export type RunLog = {
  id: string
  room_id: string
  user_id: string
  run_date: string
  km: number
  week_start: string
  created_at: string
  [key: string]: unknown
}

export type GoalHistory = {
  id: string
  room_id: string
  goal_km: number
  applied_from: string
  created_at: string
}
