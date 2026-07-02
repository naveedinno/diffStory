# Kokoro Reader Side App Design

## Goal

Build a simple sibling project at `/Users/naveed/Codes/blockchain/symmio/kokoro-reader` where the user can paste text and have it read aloud through Kokoro AI only.

## Scope

The app is a standalone local utility, not a new diffStory route. It reuses the existing Kokoro text-to-speech behavior from SmartDiffChecker where practical: voice IDs, speed bounds, generated audio caching under `~/.diffstory/tts-cache/kokoro`, and the same setup expectation from `npm run setup:kokoro`.

The app does not support browser speech or macOS `say`. Kokoro is the only voice engine.

## Architecture

The side app will be a tiny Node and TypeScript project in the sibling folder. A local server serves one HTML page and exposes a Kokoro synthesis API. The browser page posts pasted text, selected Kokoro voice, and speed to the server; the server generates or reuses cached audio and returns a local audio URL for playback.

The server should keep its own project files self-contained, but the Kokoro implementation can be copied from SmartDiffChecker so the side app does not depend on importing source across project boundaries.

## User Interface

The first screen is the actual reader, not a landing page. It has:

- A large textarea for pasted text.
- Kokoro voice choices matching the current SmartDiffChecker set: Heart, Bella, Nicole, Sarah, Adam, Onyx, Emma, and Daniel.
- Speed choices or a simple speed control bounded to the same `0.6` to `1.5` range.
- Primary Play and Stop controls.
- A small status line for generating, playing, stopped, cached, and error states.

The UI should be quiet and utilitarian: readable textarea, compact controls, no marketing sections, no decorative hero treatment.

## Data Flow

1. User pastes text.
2. User chooses voice and speed.
3. User clicks Play.
4. Browser sends `POST /api/tts/kokoro` with `{ text, voice, rate }`.
5. Server normalizes text, voice, and speed, then creates or reuses the cached `.wav`.
6. Server returns `{ cached, engine: "kokoro", rate, url, voice }`.
7. Browser creates an `Audio` object for the URL and plays it.
8. Stop pauses playback and aborts any in-flight generation request.

## Error Handling

Empty text should show a local validation message without calling the server.

Too-long text should return a clear error using the existing Kokoro max text limit.

If Kokoro or its Python environment is unavailable, the page should tell the user to run the setup command from SmartDiffChecker: `npm run setup:kokoro`.

If browser autoplay blocks playback, the status should say the audio is ready and the user can press Play again.

## Testing

The side app should include focused tests for:

- Kokoro voice normalization and aliases.
- Speed clamping.
- Cache path and URL determinism.
- Server page rendering.
- API validation for empty or invalid JSON input.

The final verification should run the side app build/tests and, if sandbox permissions allow, start the local server and load the page.
