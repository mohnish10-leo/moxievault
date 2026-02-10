-- MoxieVault schema and policies for Supabase
-- Generated from the user's Supabase AI response and cleaned for execution.

-- 1) Extensions
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2) profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- 3) vaults table
create table if not exists public.vaults (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null unique,
  description text,
  is_public boolean not null default false,
  allow_downloads boolean not null default false,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.generate_vault_share_token()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.share_token is null then
    new.share_token := replace(extensions.gen_random_uuid()::text, '-', '');
  end if;
  return new;
end;
$$;

create trigger vaults_generate_share_token
before insert on public.vaults
for each row
execute function public.generate_vault_share_token();

create or replace function public.vaults_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger vaults_set_updated_at
before update on public.vaults
for each row
execute function public.vaults_updated_at();

create or replace function public.vaults_set_private_token()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.is_public = true and new.is_public = false then
    new.share_token := replace(extensions.gen_random_uuid()::text, '-', '');
  end if;
  return new;
end;
$$;

create trigger vaults_set_private_token
before update on public.vaults
for each row
execute function public.vaults_set_private_token();

-- 4) vault_files table
create table if not exists public.vault_files (
  id uuid primary key default extensions.gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null,
  original_name text,
  size_bytes bigint default 0,
  sort_index int default 0,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.vault_files_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger vault_files_set_updated_at
before update on public.vault_files
for each row
execute function public.vault_files_updated_at();

create or replace function public.vault_files_set_uploaded_by()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger vault_files_set_uploaded_by
before insert on public.vault_files
for each row
execute function public.vault_files_set_uploaded_by();

-- 5) Storage bucket (private)
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on p.pronamespace = n.oid
    where p.proname = 'create_bucket' and n.nspname = 'storage'
  ) then
    perform storage.create_bucket('vault-files', jsonb_build_object('public', 'false'));
  end if;
end;
$$;

-- 6) Indexes
create index if not exists idx_vaults_name_trgm
  on public.vaults using gin (name gin_trgm_ops);
create index if not exists idx_vaults_owner_id on public.vaults(owner_id);
create index if not exists idx_vault_files_vault_id on public.vault_files(vault_id);
create index if not exists idx_vault_files_owner_id on public.vault_files(owner_id);
create unique index if not exists idx_vault_files_storage_path_unique
  on public.vault_files(storage_path);

-- 7) 30 MB per-vault quota enforcement
create or replace function public.enforce_vault_storage_quota()
returns trigger
language plpgsql
security definer
as $$
declare
  total bigint;
  new_size bigint := coalesce(new.size_bytes, 0);
  old_size bigint := coalesce(old.size_bytes, 0);
  vault_uuid uuid := coalesce(new.vault_id, old.vault_id);
  max_bytes constant bigint := 30 * 1024 * 1024;
begin
  if tg_op = 'INSERT' then
    select coalesce(sum(size_bytes), 0) into total
    from public.vault_files
    where vault_id = new.vault_id;
    total := total + new_size;
  elsif tg_op = 'UPDATE' then
    if new.vault_id = old.vault_id then
      select coalesce(sum(size_bytes), 0) into total
      from public.vault_files
      where vault_id = new.vault_id;
      total := total - old_size + new_size;
    else
      select coalesce(sum(size_bytes), 0) into total
      from public.vault_files
      where vault_id = new.vault_id;
      total := total + new_size;
    end if;
  elsif tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;

  if total > max_bytes then
    raise exception 'Vault storage quota exceeded for vault %: attempted %, limit % bytes',
      vault_uuid, total, max_bytes
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger vault_files_enforce_quota
before insert or update on public.vault_files
for each row
execute function public.enforce_vault_storage_quota();

-- 8) Helpers
create or replace function public.vault_total_size(v_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(size_bytes), 0)
  from public.vault_files
  where vault_id = v_id;
$$;

-- 9) RLS policies
alter table public.profiles enable row level security;
create policy profiles_owner_select on public.profiles
  for select using (auth.uid() = id);
create policy profiles_owner_insert on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_owner_update on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

alter table public.vaults enable row level security;
create policy vaults_owner_select on public.vaults
  for select using (owner_id = auth.uid());
create policy vaults_public_select on public.vaults
  for select using (is_public = true);
create policy vaults_owner_insert on public.vaults
  for insert with check (owner_id = auth.uid());
create policy vaults_owner_update on public.vaults
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy vaults_owner_delete on public.vaults
  for delete using (owner_id = auth.uid());

alter table public.vault_files enable row level security;
create policy vault_files_owner_select on public.vault_files
  for select using (owner_id = auth.uid() and deleted_at is null);
create policy vault_files_owner_insert on public.vault_files
  for insert with check (owner_id = auth.uid() and (uploaded_by is null or uploaded_by = auth.uid()));
create policy vault_files_owner_update on public.vault_files
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy vault_files_owner_delete on public.vault_files
  for delete using (owner_id = auth.uid());
create policy vault_files_vault_public_select on public.vault_files
  for select using (
    exists (
      select 1
      from public.vaults v
      where v.id = public.vault_files.vault_id
        and v.is_public = true
    )
    and deleted_at is null
  );

-- 10) Authorization helpers for downloads (backend usage)
create or replace function public.can_download_file(
  p_user uuid,
  p_vault_id uuid,
  p_share_token text
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_owner uuid;
  v_is_public boolean;
  v_allow_downloads boolean;
  v_share_token text;
begin
  select owner_id, is_public, allow_downloads, share_token
  into v_owner, v_is_public, v_allow_downloads, v_share_token
  from public.vaults
  where id = p_vault_id;

  if p_user is not null and p_user = v_owner then
    return true;
  end if;

  if v_allow_downloads = true then
    if p_share_token is not null and p_share_token = v_share_token then
      return true;
    end if;
    if v_is_public = true then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke execute on function public.can_download_file(uuid, uuid, text) from public;

create or replace function public.authorize_file_download(
  p_requesting_user uuid,
  p_vault_file_id uuid,
  p_share_token text default null
)
returns table (
  allowed boolean,
  storage_path text,
  original_name text,
  vault_id uuid
)
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
  v_storage_path text;
  v_original_name text;
  v_allowed boolean := false;
begin
  select vf.vault_id, vf.storage_path, vf.original_name
  into v_vault_id, v_storage_path, v_original_name
  from public.vault_files vf
  where vf.id = p_vault_file_id
    and deleted_at is null;

  if v_vault_id is null then
    return query select false, null::text, null::text, null::uuid;
  end if;

  v_allowed := public.can_download_file(p_requesting_user, v_vault_id, p_share_token);
  return query select v_allowed, v_storage_path, v_original_name, v_vault_id;
end;
$$;

revoke execute on function public.authorize_file_download(uuid, uuid, text) from public;

create or replace function public.can_view_file(
  p_user uuid,
  p_vault_id uuid,
  p_share_token text
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_owner uuid;
  v_is_public boolean;
  v_share_token text;
begin
  select owner_id, is_public, share_token
  into v_owner, v_is_public, v_share_token
  from public.vaults
  where id = p_vault_id;

  if p_user is not null and p_user = v_owner then
    return true;
  end if;

  if p_share_token is not null and p_share_token = v_share_token then
    return true;
  end if;

  if v_is_public = true then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.can_view_file(uuid, uuid, text) from public;

create or replace function public.authorize_file_view(
  p_requesting_user uuid,
  p_vault_file_id uuid,
  p_share_token text default null
)
returns table (
  allowed boolean,
  storage_path text,
  original_name text,
  vault_id uuid
)
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
  v_storage_path text;
  v_original_name text;
  v_allowed boolean := false;
begin
  select vf.vault_id, vf.storage_path, vf.original_name
  into v_vault_id, v_storage_path, v_original_name
  from public.vault_files vf
  where vf.id = p_vault_file_id
    and deleted_at is null;

  if v_vault_id is null then
    return query select false, null::text, null::text, null::uuid;
  end if;

  v_allowed := public.can_view_file(p_requesting_user, v_vault_id, p_share_token);
  return query select v_allowed, v_storage_path, v_original_name, v_vault_id;
end;
$$;

revoke execute on function public.authorize_file_view(uuid, uuid, text) from public;

-- 11) Search RPC for partial matches
create or replace function public.search_vaults_by_name(
  p_user uuid,
  p_name_fragment text,
  p_limit int default 20
)
returns table (
  id uuid,
  name text,
  description text,
  owner_id uuid,
  is_public boolean,
  share_token text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  select v.id, v.name, v.description, v.owner_id, v.is_public, v.share_token,
         v.created_at, v.updated_at
  from public.vaults v
  where (v.is_public = true and v.name ilike ('%' || p_name_fragment || '%'))
     or (v.owner_id = p_user and v.name ilike ('%' || p_name_fragment || '%'))
  order by v.created_at desc
  limit p_limit;
$$;

revoke execute on function public.search_vaults_by_name(uuid, text, int) from public;

-- 12) Public search (includes private vault names)
create or replace function public.search_vaults_by_name_all(
  p_name_fragment text,
  p_limit int default 20
)
returns table (
  id uuid,
  name text,
  description text,
  is_public boolean,
  created_at timestamptz
)
language sql
security definer
stable
as $$
  select v.id, v.name, v.description, v.is_public, v.created_at
  from public.vaults v
  where v.name ilike ('%' || p_name_fragment || '%')
  order by v.created_at desc
  limit p_limit;
$$;

grant execute on function public.search_vaults_by_name_all(text, int) to anon, authenticated;

-- 12) Storage policies for vault-files bucket
-- Allow authenticated users to upload/delete objects in their own folder path: {userId}/vaultId/filename
create policy storage_vault_files_insert
  on storage.objects for insert
  with check (
    bucket_id = 'vault-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_vault_files_delete
  on storage.objects for delete
  using (
    bucket_id = 'vault-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_vault_files_select
  on storage.objects for select
  using (
    bucket_id = 'vault-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
