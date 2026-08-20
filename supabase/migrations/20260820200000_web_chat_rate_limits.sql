create table public.web_chat_rate_limits (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (clinic_id, bucket_key)
);

alter table public.web_chat_rate_limits enable row level security;

create or replace function public.consume_web_chat_rate_limit(
  p_clinic_id uuid,
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_bucket_key) < 8 then
    return false;
  end if;

  insert into web_chat_rate_limits (clinic_id, bucket_key, window_start, request_count)
  values (p_clinic_id, p_bucket_key, now(), 1)
  on conflict (clinic_id, bucket_key) do update
  set window_start = case
        when web_chat_rate_limits.window_start <= now() - make_interval(secs => p_window_seconds)
          then now()
        else web_chat_rate_limits.window_start
      end,
      request_count = case
        when web_chat_rate_limits.window_start <= now() - make_interval(secs => p_window_seconds)
          then 1
        else web_chat_rate_limits.request_count + 1
      end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_web_chat_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_web_chat_rate_limit(uuid, text, integer, integer)
  to service_role;
