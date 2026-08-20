-- WhatsApp channel credentials live in Supabase Vault. The channel row only
-- stores the opaque Vault identifier and non-secret routing metadata.
alter table public.clinic_channels
  add column if not exists vault_secret_id uuid;

create index if not exists clinic_channels_provider_status_idx
  on public.clinic_channels (provider, channel_type, status);

comment on column public.clinic_channels.vault_secret_id is
  'Supabase Vault secret containing the provider API key; never expose to clients.';
