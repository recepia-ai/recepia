-- Complete the historical Vapi evidence redaction started in
-- 20260926190000_redact_vapi_artifact_references.
--
-- Keep call identity, transcripts, messages, duration, status, costs and other
-- non-sensitive evidence. Remove only provider media/control URLs and embedded
-- credentials that are neither required for traceability nor safe at rest.

update public.channel_events
set payload = payload
  -- Legacy media references outside message.artifact.
  #- '{message,recordingUrl}'
  #- '{message,stereoRecordingUrl}'
  #- '{message,videoRecordingUrl}'
  #- '{message,logUrl}'
  #- '{message,pcapUrl}'
  -- Ephemeral Vapi call control/transport credentials.
  #- '{message,call,monitor,controlUrl}'
  #- '{message,call,transport,callToken}'
  -- Dynamic phone server URL and authentication material.
  #- '{message,phoneNumber,server,url}'
  #- '{message,phoneNumber,server,secret}'
  #- '{message,phoneNumber,server,headers,x-vapi-secret}'
  #- '{message,phoneNumber,twilioAuthToken}'
  -- Vapi duplicates phone/call configuration in artifact variables.
  #- '{message,artifact,variables,call,transport,callToken}'
  #- '{message,artifact,variables,transport,callToken}'
  #- '{message,artifact,variables,phoneNumber,server,url}'
  #- '{message,artifact,variables,phoneNumber,server,secret}'
  #- '{message,artifact,variables,phoneNumber,server,headers,x-vapi-secret}'
  #- '{message,artifact,variables,phoneNumber,twilioAuthToken}'
  #- '{message,artifact,variableValues,call,transport,callToken}'
  #- '{message,artifact,variableValues,transport,callToken}'
  #- '{message,artifact,variableValues,phoneNumber,server,url}'
  #- '{message,artifact,variableValues,phoneNumber,server,secret}'
  #- '{message,artifact,variableValues,phoneNumber,server,headers,x-vapi-secret}'
  #- '{message,artifact,variableValues,phoneNumber,twilioAuthToken}'
where provider = 'vapi'
  and event_type = 'end-of-call-report';

