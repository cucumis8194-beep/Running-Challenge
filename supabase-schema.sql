-- Supabase SQL: 아래 SQL을 Supabase > SQL Editor에 붙여넣고 실행하세요.

create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  name text not null,
  goal_km numeric(5,1) not null default 5.0,
  penalty text not null default '아이스아메리카노 1잔',
  created_by text not null,
  created_at timestamptz default now()
);

create table if not exists members (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  nickname text not null,
  joined_at timestamptz default now(),
  unique(room_id, nickname)
);

create table if not exists run_logs (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  nickname text not null,
  run_date date not null,
  km numeric(5,2) not null,
  week_start date not null,
  created_at timestamptz default now()
);

-- 실시간 구독을 위한 RLS(Row Level Security) 설정
alter table rooms enable row level security;
alter table members enable row level security;
alter table run_logs enable row level security;

-- 누구나 읽기/쓰기 가능 (개인 챌린지용 간단 설정)
create policy "public read rooms" on rooms for select using (true);
create policy "public insert rooms" on rooms for insert with check (true);
create policy "public update rooms" on rooms for update using (true);

create policy "public read members" on members for select using (true);
create policy "public insert members" on members for insert with check (true);
create policy "public delete members" on members for delete using (true);

create policy "public read logs" on run_logs for select using (true);
create policy "public insert logs" on run_logs for insert with check (true);
create policy "public delete logs" on run_logs for delete using (true);

-- 실시간 기능 활성화
alter publication supabase_realtime add table run_logs;
alter publication supabase_realtime add table members;
