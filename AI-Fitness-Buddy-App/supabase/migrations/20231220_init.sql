-- 1. Profiles: Stores user constraints & physical data
create table public.profiles (
  id uuid references auth.users not null primary key,
  goal text check (goal in ('lose_weight', 'build_muscle', 'endurance', 'strength')),
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')),
  equipment text[] default '{}', -- e.g., ['dumbbells', 'bands']
  days_per_week int default 3,
  session_duration_minutes int default 45,
  is_premium boolean default false, -- synced from RevenueCat or checked via Edge Function
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- 2. Plans: The AI Output
create table public.plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  active boolean default true,
  -- We store the entire weekly schedule as a structured JSON blob
  -- Structure: { "week_1": [ { "day": 1, "exercises": [...] } ] }
  data jsonb not null, 
  created_at timestamptz default now()
);

alter table public.plans enable row level security;
create policy "Users can view own plans" on plans for select using (auth.uid() = user_id);
create policy "Users can insert own plans" on plans for insert with check (auth.uid() = user_id);

-- 3. Workout Logs: The feedback loop
create table public.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  plan_id uuid references public.plans(id),
  
  -- Context
  workout_day_index int, -- Which day of the plan was this?
  completed_at timestamptz default now(),
  
  -- Feedback
  rpe int check (rpe between 1 and 10), -- Rate of Perceived Exertion
  fatigue_level text check (fatigue_level in ('low', 'medium', 'high')),
  notes text
);

alter table public.workout_logs enable row level security;
create policy "Users can view own logs" on workout_logs for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on workout_logs for insert with check (auth.uid() = user_id);