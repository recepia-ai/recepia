-- Redact historical Vapi webhook payloads across every event type.
--
-- Keep transcripts, message text, call identity, event identity, status,
-- timestamps and all non-sensitive operational evidence. This mirrors the
-- recursive runtime sanitizer in apps/panel/src/lib/channels/vapi-artifacts.ts.

create function pg_temp.redact_vapi_sensitive_jsonb(value jsonb)
returns jsonb
language plpgsql
immutable
strict
as $$
declare
  value_type text := jsonb_typeof(value);
  result jsonb;
begin
  if value_type = 'object' then
    select coalesce(jsonb_object_agg(entry.key, pg_temp.redact_vapi_sensitive_jsonb(entry.value)), '{}'::jsonb)
      into result
      from jsonb_each(value) as entry
     where not (
       entry.key in (
         'callToken',
         'controlUrl',
         'logUrl',
         'pcapUrl',
         'presignedAssistantUrl',
         'presignedCustomerUrl',
         'presignedLogUrl',
         'presignedMonoUrl',
         'presignedStereoUrl',
         'presignedUrlsExpiresAt',
         'recording',
         'recordingUrl',
         'secret',
         'stereoRecordingUrl',
         'twilioAuthToken',
         'videoRecordingUrl'
       )
       or lower(entry.key) in (
         'authorization',
         'x-vapi-secret',
         'x-vercel-protection-bypass'
       )
       or (
         jsonb_typeof(entry.value) = 'string'
         and entry.value #>> '{}'
           ~* '^https?://.*[?&](x-vercel-protection-bypass|x-amz-credential|x-amz-signature)='
       )
     );
    return result;
  end if;

  if value_type = 'array' then
    select coalesce(jsonb_agg(pg_temp.redact_vapi_sensitive_jsonb(item.value) order by item.ordinality), '[]'::jsonb)
      into result
      from jsonb_array_elements(value) with ordinality as item(value, ordinality);
    return result;
  end if;

  return value;
end;
$$;

update public.channel_events
   set payload = pg_temp.redact_vapi_sensitive_jsonb(payload)
 where provider = 'vapi'
   and payload is distinct from pg_temp.redact_vapi_sensitive_jsonb(payload);

