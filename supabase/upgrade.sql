-- MoxieVault upgrade (run once on existing project)

-- 1) Add audit columns
alter table public.vault_files
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- 2) Set uploaded_by trigger
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

drop trigger if exists vault_files_set_uploaded_by on public.vault_files;
create trigger vault_files_set_uploaded_by
before insert on public.vault_files
for each row
execute function public.vault_files_set_uploaded_by();

-- 2b) Rotate token when switching public -> private
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

drop trigger if exists vaults_set_private_token on public.vaults;
create trigger vaults_set_private_token
before update on public.vaults
for each row
execute function public.vaults_set_private_token();

-- 3) Update policies for soft delete visibility and uploaded_by
drop policy if exists vault_files_owner_select on public.vault_files;
create policy vault_files_owner_select on public.vault_files
  for select using (owner_id = auth.uid() and deleted_at is null);

drop policy if exists vault_files_owner_insert on public.vault_files;
create policy vault_files_owner_insert on public.vault_files
  for insert with check (owner_id = auth.uid() and (uploaded_by is null or uploaded_by = auth.uid()));

drop policy if exists vault_files_vault_public_select on public.vault_files;
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

-- 4) Update authorize functions to ignore deleted rows
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

-- 5) Add view authorization
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

-- 6) Storage policies (drop then recreate)
drop policy if exists storage_vault_files_insert on storage.objects;
drop policy if exists storage_vault_files_delete on storage.objects;
drop policy if exists storage_vault_files_select on storage.objects;

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

-- 7) Public search (includes private vault names)
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
