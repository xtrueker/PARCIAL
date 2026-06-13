-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('docente', 'estudiante')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- Create policies for profiles
create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

create policy "Allow individual write access to profiles" on public.profiles
  for update using (auth.uid() = id);

-- Trigger to sync auth.users with public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'estudiante')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create availability table
create table public.availability (
  id bigint generated always as identity primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  day text not null check (day in ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')),
  start text not null, -- format 'HH:MM'
  "end" text not null,   -- format 'HH:MM'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for availability
alter table public.availability enable row level security;

-- Policies for availability
create policy "Allow public read access to availability" on public.availability
  for select using (true);

create policy "Allow teachers to insert availability" on public.availability
  for insert with check (auth.uid() = teacher_id);

create policy "Allow teachers to delete availability" on public.availability
  for delete using (auth.uid() = teacher_id);

-- Create requests table
create table public.requests (
  id bigint generated always as identity primary key,
  student_id uuid references public.profiles(id) on delete cascade not null,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  subject text not null,
  date date not null,
  time text not null, -- format 'HH:MM'
  description text,
  status text not null check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')) default 'pending',
  rating integer check (rating >= 1 and rating <= 5),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for requests
alter table public.requests enable row level security;

-- Policies for requests
create policy "Allow users to read their own requests" on public.requests
  for select using (auth.uid() = student_id or auth.uid() = teacher_id);

create policy "Allow students to insert requests" on public.requests
  for insert with check (auth.uid() = student_id);

create policy "Allow users to update their own requests" on public.requests
  for update using (auth.uid() = student_id or auth.uid() = teacher_id);

create policy "Allow users to delete their own requests" on public.requests
  for delete using (auth.uid() = student_id or auth.uid() = teacher_id);
