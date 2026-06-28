import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Room = {
  id: string
  code: string
  name: string
  goal_km: number
  penalty: string
  created_by: string
  created_at: string
}

export type Member = {
  id: string
  room_id: string
  nickname: string
  joined_at: string
}

export type RunLog = {
  id: string
  room_id: string
  nickname: string
  run_date: string
  km: number
  week_start: string
  created_at: string
}
