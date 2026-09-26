import assert from "node:assert/strict";
import test from "node:test";
import { redactVapiArtifactReferences } from "./vapi-artifacts.ts";

test("redacts Vapi recording and diagnostic references without mutating the webhook", () => {
  const payload = {
    message: {
      type: "end-of-call-report",
      call: { id: "call-1" },
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
  assert.ok(payload.message.artifact.recording);
});

test("leaves non-artifact webhook payloads intact", () => {
  const payload = { message: { type: "status-update", call: { id: "call-1" } } };
  assert.deepEqual(redactVapiArtifactReferences(payload), payload);
});
