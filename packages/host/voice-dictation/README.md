# @deepseek-ai/dsh-host-voice-dictation

Remote host for the browser voice-dictation plugin. It exposes a `voiceTranscribe`
Remote whose single method (`transcribe`) takes a base64-encoded audio clip,
writes it to a temp file, ensures the claude-voice `whisper-server` daemon is
running, runs `transcribe.py`, and returns the transcribed text.

The browser client never talks to the whisper socket directly: the Host bridges
the Unix socket (which the page cannot reach) with `node:child_process`.

## Configuration

| key | default | |
| --- | --- | --- |
| `voiceRoot` | `/Users/nahuelmaeso/Desktop/claude-software/claude-voice` | claude-voice checkout (must have `whisper-env/bin/python`) |
| `model` | `large-v3-turbo` | Whisper model (must match the daemon socket) |
| `language` | `auto` | `auto` detects, or a code like `es` |
| `serverWaitMs` | `30000` | budget for the daemon socket to appear |
| `timeoutMs` | `180000` | transcription command budget |

## Model Experience

This is a host-side Remote. It does not alter model token windows, prompts, or
KV-cache behavior; it only answers one client RPC. The model never sees the
transcription path except through the resulting message the user sends.

## Known Limitations and Deferred Work

- The default `voiceRoot` points at one machine's checkout; a different install
  must set `voiceRoot` in the composition.
- The daemon is auto-started but not auto-stopped; a `whisper-server` left warm
  exits on its own 30-minute idle timeout.
- Transcription progress is not streamed: `whisper-server` returns text only at
  the end, so the client estimates 0–100%.
