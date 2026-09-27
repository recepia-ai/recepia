import assert from "node:assert/strict";
import test from "node:test";
import { redactVapiArtifactReferences } from "./vapi-artifacts.ts";

test("redacts Vapi recording and diagnostic references without mutating the webhook", () => {
  const payload = {
    message: {
      type: "end-of-call-report",
      call: {
        id: "call-1",
        monitor: { controlUrl: "https://control.vapi.ai/call-1" },
        transport: { callToken: "call-secret" },
      },
      phoneNumber: {
        id: "phone-1",
        server: {
          url: "https://preview.example/webhook?x-vercel-protection-bypass=secret",
          secret: "server-secret",
          headers: { "x-vapi-secret": "webhook-secret", "x-trace": "safe" },
        },
      },
      recordingUrl: "https://private.example/message-recording",
      stereoRecordingUrl: "https://private.example/message-stereo",
      artifact: {
        transcript: "User: hola",
        messages: [{ role: "user", message: "hola" }],
        recording: {
          mono: "https://private.example/mono",
          stereoUrl: "https://private.example/stereo",
        },
        recordingUrl: "https://private.example/legacy-mono",
        stereoRecordingUrl: "https://private.example/legacy-stereo",
        presignedMonoUrl: "https://signed.example/mono?token=secret",
        presignedStereoUrl: "https://signed.example/stereo?token=secret",
        presignedLogUrl: "https://signed.example/log?token=secret",
        presignedUrlsExpiresAt: "2026-09-26T10:00:00Z",
        logUrl: "https://private.example/log",
        pcapUrl: "https://private.example/pcap",
        variables: {
          phoneNumber: {
            server: {
              url: "https://preview.example/webhook?x-vercel-protection-bypass=secret",
              headers: { "x-vapi-secret": "webhook-secret" },
            },
            twilioAuthToken: "twilio-secret",
          },
        },
      },
    },
  };

  const redacted = redactVapiArtifactReferences(payload);
  const artifact = redacted.message.artifact;

  assert.equal(artifact.transcript, "User: hola");
  assert.deepEqual(artifact.messages, [{ role: "user", message: "hola" }]);
  assert.equal("recording" in artifact, false);
  assert.equal("recordingUrl" in artifact, false);
  assert.equal("stereoRecordingUrl" in artifact, false);
  assert.equal("presignedMonoUrl" in artifact, false);
  assert.equal("presignedStereoUrl" in artifact, false);
  assert.equal("presignedLogUrl" in artifact, false);
  assert.equal("presignedUrlsExpiresAt" in artifact, false);
  assert.equal("logUrl" in artifact, false);
  assert.equal("pcapUrl" in artifact, false);
  assert.equal("recordingUrl" in redacted.message, false);
  assert.equal("stereoRecordingUrl" in redacted.message, false);
  assert.equal("controlUrl" in redacted.message.call.monitor, false);
  assert.equal("callToken" in redacted.message.call.transport, false);
  assert.equal("url" in redacted.message.phoneNumber.server, false);
  assert.equal("secret" in redacted.message.phoneNumber.server, false);
  assert.equal("x-vapi-secret" in redacted.message.phoneNumber.server.headers, false);
  assert.equal(redacted.message.phoneNumber.server.headers["x-trace"], "safe");
  assert.equal("url" in artifact.variables.phoneNumber.server, false);
  assert.equal("x-vapi-secret" in artifact.variables.phoneNumber.server.headers, false);
  assert.equal("twilioAuthToken" in artifact.variables.phoneNumber, false);
  assert.equal(redacted.message.call.id, "call-1");
  assert.equal(redacted.message.phoneNumber.id, "phone-1");
  assert.ok(payload.message.artifact.recording);
});

test("leaves non-artifact webhook payloads intact", () => {
  const payload = { message: { type: "status-update", call: { id: "call-1" } } };
  assert.deepEqual(redactVapiArtifactReferences(payload), payload);
});

test("redacts presigned URLs outside known artifact paths", () => {
  const payload = {
    message: {
      type: "end-of-call-report",
      evidence: {
        download: "https://signed.example/file?X-Amz-Credential=id&X-Amz-Signature=secret",
        publicUrl: "https://recepia.example/calls/call-1",
      },
    },
  };

  const redacted = redactVapiArtifactReferences(payload);
  assert.equal("download" in redacted.message.evidence, false);
  assert.equal(redacted.message.evidence.publicUrl, payload.message.evidence.publicUrl);
});
