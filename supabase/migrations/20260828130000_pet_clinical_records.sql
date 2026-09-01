-- Pet clinical history, private attachments and wider species support.

alter table pets drop constraint if exists pets_species_check;
alter table pets add constraint pets_species_check check (
  species in ('dog', 'cat', 'rabbit', 'ferret', 'rodent', 'bird', 'reptile', 'other')
);

create table if not exists pet_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  record_type text not null check (
    record_type in ('pathology', 'report', 'radiograph', 'analysis', 'prescription', 'note')
  ),
  title text not null,
  description text,
  occurred_at date not null default current_date,
  external_url text,
  file_path text,
  file_name text,
  mime_type text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists pet_records_clinic_pet_date_idx
  on pet_records (clinic_id, pet_id, occurred_at desc, created_at desc)
  where deleted_at is null;

drop trigger if exists set_updated_at_pet_records on pet_records;
create trigger set_updated_at_pet_records
before update on pet_records for each row execute function set_updated_at();

alter table pet_records enable row level security;

drop policy if exists pet_records_member_read on pet_records;
create policy pet_records_member_read on pet_records for select
  using (clinic_id in (select user_clinic_ids()) and deleted_at is null);

drop policy if exists pet_records_member_insert on pet_records;
create policy pet_records_member_insert on pet_records for insert
  with check (
    clinic_id in (select user_clinic_ids())
    and created_by_user_id = auth.uid()
    and exists (
      select 1 from pets
      where pets.id = pet_records.pet_id
        and pets.clinic_id = pet_records.clinic_id
        and pets.deleted_at is null
    )
  );

drop policy if exists pet_records_member_update on pet_records;
create policy pet_records_member_update on pet_records for update
  using (clinic_id in (select user_clinic_ids()))
  with check (clinic_id in (select user_clinic_ids()));

drop policy if exists pet_records_member_delete on pet_records;
create policy pet_records_member_delete on pet_records for delete
  using (clinic_id in (select user_clinic_ids()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-records',
  'pet-records',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pet_record_files_member_read on storage.objects;
create policy pet_record_files_member_read on storage.objects for select
  using (
    bucket_id = 'pet-records'
    and (storage.foldername(name))[1] in (select user_clinic_ids()::text)
  );

drop policy if exists pet_record_files_member_insert on storage.objects;
create policy pet_record_files_member_insert on storage.objects for insert
  with check (
    bucket_id = 'pet-records'
    and (storage.foldername(name))[1] in (select user_clinic_ids()::text)
  );

drop policy if exists pet_record_files_member_delete on storage.objects;
create policy pet_record_files_member_delete on storage.objects for delete
  using (
    bucket_id = 'pet-records'
    and (storage.foldername(name))[1] in (select user_clinic_ids()::text)
  );
