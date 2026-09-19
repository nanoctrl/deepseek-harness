# @deepseek-ai/dsh-host-voice-dictation

## Summary

The host half of the voice plugin: one `voiceTranscribe` Remote with both directions. `transcribe` runs a base64 audio clip through the claude-voice `whisper-server` daemon. `synthesize` speaks one segment of prose with a fully local engine, either the claude-voice Kokoro ONNX daemon or the macOS `say` voice, and returns it as AAC. Every temp file either direction creates is deleted before the reply is returned, and each call sweeps temporaries left by a killed process.

## Use this package

Remote host for the browser voice-dictation plugin. It exposes a `voiceTranscribe` Remote with both voice directions:

- **`transcribe`** takes a base64-encoded audio clip, writes it to a temp file, ensures the claude-voice `whisper-server` daemon is running, runs `transcribe.py`, and returns the transcribed text.
- **`synthesize`** takes one segment of prose and speaks it on this machine, then converts the result to AAC with `afconvert` and returns the bytes base64. Two engines, both fully local:
  - `kokoro` (default) requests the segment from the claude-voice Kokoro ONNX daemon over its Unix socket. The model is 310 MB of ONNX plus a 27 MB voice bank, both already on disk; nothing leaves the machine and there is no per-request model load because the daemon keeps it warm.
  - `say` runs the macOS voice directly. It needs no daemon and no model download, at noticeably lower quality.

The browser client never talks to either socket directly: the Host bridges them (which the page cannot reach) with `node:child_process`. The audio never survives the call:

- Both engines delete every temp file they create or receive, including the Kokoro daemon's own WAV and `say`'s intermediate AIFF, **before** the bytes are returned — so the file is already gone when the client starts playing.
- Each `synthesize` also sweeps any synthesis temporary older than ten minutes under the plugin's own `dsh-tts-` prefix and the daemon's `tts_` prefix. That is what reclaims a file orphaned by a killed process, and the age guard keeps the sweep away from a concurrent synthesis.
- The client holds a segment as an in-memory data URL only until it finishes playing, then drops both the URL and the audio element.

## Configuration

| key | default | |
| --- | --- | --- |
| `voiceRoot` | `/Users/nahuelmaeso/Desktop/claude-software/claude-voice` | claude-voice checkout (has `whisper-env/` and `tts-env/`) |
| `model` | `large-v3-turbo` | Whisper model (must match the daemon socket) |
| `language` | `auto` | `auto` detects, or a code like `es` |
| `serverWaitMs` | `30000` | budget for the whisper daemon socket to appear |
| `timeoutMs` | `180000` | transcription command budget |
| `ttsEngine` | `kokoro` | `kokoro` (local ONNX daemon) or `say` (macOS voice) |
| `ttsVoice` | `''` | voice of the chosen engine; empty picks `ef_dora` for kokoro, `Paulina` for say |
| `ttsBitrate` | `48000` | AAC bit rate; the reply is base64, so this sizes the payload |
| `ttsWaitMs` | `30000` | budget for the Kokoro daemon to accept a request |

The two engines name voices differently, so `ttsVoice` has no cross-engine default: leaving it empty resolves to the chosen engine's own voice. `ef_dora` is the only female Spanish voice in Kokoro v1.0; `Paulina` is the `es_MX` macOS voice, and macOS ships no `es_AR` voice.

## Model Experience

This is a host-side Remote. It does not alter model token windows, prompts, or KV-cache behavior; it only answers client RPCs. The model never sees either path except through the resulting message the user sends.

## Known Limitations and Deferred Work

- The default `voiceRoot` points at one machine's checkout; a different install must set `voiceRoot` in the composition.
- Both daemons are auto-started but not auto-stopped; each exits on its own 30-minute idle timeout.
- Transcription progress is not streamed: `whisper-server` returns text only at the end, so the client estimates 0–100%.
- The `say` engine is macOS-only (`/usr/bin/say`); the `kokoro` engine only needs Python and the claude-voice checkout, and `afconvert` is macOS-only in both. Another platform needs a different provider behind the same Remote.
- `synthesize` accepts one segment of at most 4000 characters. The client splits a message well below that ceiling, so the cap only guards a direct caller against a reply too large to carry base64.
- The first `synthesize` after a boot pays the Kokoro daemon's start: about 4 s for the process plus the 310 MB model load. Later segments reuse the warm model (about 1.4 s for the client's 90-character first segment).
- Kokoro reaches roughly 3.7x realtime on this machine, so the client's prefetch keeps up to about 3.7x playback speed; the UI caps at 2x.
- The Kokoro daemon writes each result to a temp WAV and never removes it. This plugin deletes the file it reads, but another client of that daemon (for example claude-voice's own `speak.py`) can leave `tts_*` files in `/tmp`.
- `tts-server.py` answers a request and then closes the socket; a client that connects and drops without sending would leave it writing to a closed socket, which raises outside its inner handler and ends the process. This plugin always finishes the exchange, but the daemon is fragile against other callers.
