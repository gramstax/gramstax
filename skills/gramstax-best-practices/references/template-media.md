# template-media

Declare media with `g-media`; group with pipes or `<g-media-group>`; voice-like types delete-then-send on edit.

## Why

Media sent as a document when a photo was intended (or vice versa) confuses users and breaks clients; voice, video notes, stickers, locations, and contacts cannot be silently swapped in place — editing them without deleting first leaves ghost messages.

## Incorrect

```typescript
// single photo declared, but the flow needs an album + caption
const template = `<g-base><g-media type="photo" src="a.jpg"></g-media></g-base>`
```

## Correct

```typescript
const template = `<g-base>
  <g-media-group><g-media type="photo" src="a.jpg">Cap</g-media><g-media type="photo" src="b.jpg"></g-media></g-media-group>
  <g-media type="photo" src="one.jpg|two.jpg">Album</g-media>
  <g-media type="voice" src="v.ogg"></g-media>
</g-base>`
```

## Notes

- `type`: photo, video, audio, document, animation, voice, video_note, sticker, location, contact. `src` required; `caption` optional; `lang`/`shared` for variants.
- Pipe-delimited `src` (`a.jpg|b.jpg`) sends a media group — photo/video/audio/document only. Keyboards are ignored for grouped media.
- Group caption comes from the first captioned item; max 10 items (`MAX_MEDIA_GROUP_ITEMS`); audio/document items cannot mix with other types.
- On edit, voice/video_note/sticker/location/contact are delete-then-send (no in-place media swap); photo/video/audio/document/animation edit in place via `editMessageMedia`.
