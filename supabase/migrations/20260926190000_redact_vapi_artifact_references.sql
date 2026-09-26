-- Remove Vapi bearer/presigned artifact references already persisted locally.
-- The durable provider_call_id remains sufficient for future authenticated,
-- server-side retrieval. Audio itself has never been copied to Supabase Storage.

update public.call_sessions
set metadata = (metadata - 'recording_url') || jsonb_build_object('recording_available', true)
where provider = 'vapi'
  and nullif(metadata ->> 'recording_url', '') is not null;

update public.channel_events
set payload = payload
  #- '{message,artifact,recording}'
  #- '{message,artifact,recordingUrl}'
  #- '{message,artifact,stereoRecordingUrl}'
  #- '{message,artifact,videoRecordingUrl}'
  #- '{message,artifact,logUrl}'
  #- '{message,artifact,pcapUrl}'
  #- '{message,artifact,presignedAssistantUrl}'
  #- '{message,artifact,presignedCustomerUrl}'
  #- '{message,artifact,presignedLogUrl}'
  #- '{message,artifact,presignedMonoUrl}'
  #- '{message,artifact,presignedStereoUrl}'
  #- '{message,artifact,presignedUrlsExpiresAt}'
where provider = 'vapi'
  and event_type = 'end-of-call-report';

comment on column public.call_sessions.recording_storage_path is
  'Private Recepia-owned storage path only; never store provider or presigned URLs.';
