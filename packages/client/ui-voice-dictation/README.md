# @deepseek-ai/dsh-client-ui-voice-dictation

## Summary

The Web GUI's voice surface for the composer, in both directions. The mic records a message and transcribes it through the host `voiceTranscribe` Remote, inserting the text at the caret of the Session it was recorded in. Read-aloud speaks a finalized assistant message with a fully local engine: one control per message, plus a composer button that transforms from play to stop. Messages are rewritten from Markdown into speakable prose before synthesis, and no generated audio outlives its playback.

## Use this package

Two directions of voice in the composer, backed by one host package.

**Dictation.** Click the mic (or **Ctrl+M**) to start recording; a red circle slides to screen center and grows with the voice. A double clap, a double snap, **Enter**, or a click on the circle stops and transcribes through the host `voiceTranscribe` Remote, showing an estimated 0→100% progress. A failed transcription keeps the recording, so it can be retried by clicking the error button or downloaded with the button beside it.

The finished text is **inserted at the caret** of the composer it was recorded in. Two properties matter here, and both are deliberate:

- It never replaces. `setDraft` substitutes the whole draft, so appending through it with a copy read when recording *started* would silently discard everything typed since. The insertion asks the editor for the caret span and hands it back through `insertText`, which carries the revision it was read at: a concurrent edit refuses the write instead of clobbering it, and one retry covers ordinary typing races.
- It lands in the Session that was recorded in. The id is captured when recording starts, and the text is routed there through `sessions.scope(id)` → `that scope's conversation service` → `input.for(actx)`. Recording in one conversation and moving to another while it transcribes still lands the text in the first one. If that Session's composer is gone, the insertion is refused and the recording is kept for retry or download rather than being written somewhere wrong.

Leaving the composer while recording releases the microphone; it does not stay open behind another Session.

**Read-aloud.** Next to the composer's mic sits a **single button that transforms**: in repose it plays the last finalized assistant message, and while that reading sounds it becomes the stop that cuts it — the same control, so there is nothing to look for. Every finalized assistant message also gets its own play control beside its copy/branch/feedback actions; **Ctrl+N** reads the last message. While a message is being read, that row grows a progress bar, a speed chip, and a **stop control** — the chip cycles 0.75x → 1x → 1.25x → 1.5x → 2x and the choice survives a reload. Speed is applied to the audio element, so changing it neither re-synthesizes nor loses position.

Pause and stop are deliberately separate. A message's own play control toggles playback and keeps the current segment loaded so it can resume; **stop** ends the reading and destroys the retained audio. Stop is reachable four ways: the composer button once it has transformed, the per-message stop, **Escape**, and **Ctrl+N** while something is playing. Leaving the Session stops it too, so audio can never keep playing with no control in sight.

## Model Experience

No model-visible input: this plugin only produces a user-writable draft in the composer, and read-aloud only consumes text the model already produced. It adds no prompt section, tool, or token-window change.

## Known Limitations and Deferred Work

- The 0→100% transcription progress is **estimated** by the client from the recorded duration (the host `whisper-server` returns text only at the end) — it is not a real streamed count.
- Dictation auto-stop by silence (VAD) is not implemented; recording stops on Enter/click/`Ctrl+M`/double transient.
- The recording overlay uses `position: fixed`; a transformed ancestor could offset it.
- Read-aloud cuts the message client-side at sentence ends, with a **shorter first segment** (90 characters) than the rest (280). Only the first segment is waited for, so the start costs one short synthesis; the remaining segments are prefetched while the previous one plays, which is why they can be longer without adding latency.
- Read-aloud rewrites the message's Markdown into speakable prose before it reaches the synthesizer, because a raw message makes the voice pronounce its own syntax — a link's URL, a table's pipes, emphasis asterisks. That stage resolves three separate things:
  1. **Syntax.** `toSpeakable` strips emphasis, backticks, HTML, and escapes, keeps a link's label and discards its destination, and turns headings, quotes, and list markers into sentence boundaries.
  2. **Pronunciation.** `toSpokenToken` rewrites code spans as they are said, not as they are written: `run_search_background` is three words, `HttpClient` is two, `src/client/index.ts` is a path, `deploy()` loses its argument list, and `--force` loses its dashes. Case is preserved so an acronym keeps sounding like one.
  3. **Structure.** What reads badly aloud is either read properly or sent to the screen: a small table is announced with its columns and then read row by row, while a large one (over 10 rows or 4 columns) is announced and the listener is sent to look at it. A code block is announced with its language and line count instead of being read or silently dropped. A list is announced by length and its items become separate sentences.
- Those announcements are copy, so they come from the locale dictionary; `toSpeakable` takes them as parameters and owns no wording. They are rebuilt per reading, so they follow the active locale.
- The rewriting is rule-based, not semantic. It knows what is *format* versus what is *content*, and how a piece of content is pronounced, but it does not understand what any of it *means*: it reads a table's rows faithfully and cannot tell you which row matters, and it cannot summarize.
- Symbol operators inside inline code are dropped rather than spelled, so `a !== b` reads as "a b". Inline code in prose is overwhelmingly identifiers, paths, and commands, where that is right; an inline expression is where this reads worst.
- Generated audio does not survive playback. The host deletes each synthesis file before returning the bytes, and the client drops each segment's data URL and releases its audio element the moment that segment ends; stopping, finishing, or failing clears whatever is left. Only the segment being played and the one prefetched behind it are ever held.
- The voice comes from the host `ttsVoice` Config, and the engine from `ttsEngine`. The default is the local Kokoro ONNX model with `ef_dora`, its only female Spanish voice; `say` with macOS `Paulina` (`es_MX`) is the lower-quality native alternative. Neither is `es_AR`: no such voice exists in either engine.
- The first read-aloud after a boot waits about 4 s while the Kokoro daemon starts and loads its 310 MB model. Later segments reuse the warm model.
- `Ctrl+N` is handled on the page, not by a keybinding registry; a future host-level shortcut binding should replace the window listener.
