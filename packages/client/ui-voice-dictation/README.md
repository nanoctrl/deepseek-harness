# @deepseek-ai/dsh-client-ui-voice-dictation

Composer mic button for voice dictation. Click (or **Ctrl+M**) starts recording; a red circle slides to screen center and grows with the voice. **Enter** (or a click on the circle) stops and transcribes through the host `voiceTranscribe` Remote, showing an estimated 0→100% progress. On success the text is inserted into the composer with the caret placed at the end, so Enter sends it immediately.

## Model Experience

No model-visible input: this plugin only produces a user-writable draft in the composer. It adds no prompt section, tool, or token-window change.

## Known Limitations and Deferred Work

- The 0→100% progress is **estimated** by the client from the recorded duration (the host `whisper-server` returns text only at the end) — it is not a real streamed count.
- Auto-stop after silence (VAD) is not implemented; recording stops on Enter/click/`Ctrl+M`.
- The recording overlay uses `position: fixed`; a transformed ancestor could offset it.
