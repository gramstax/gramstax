# template-rich

Author Telegram Rich HTML from the 54-tag allowlist; void tags self-close; unknown attributes fail validation.

## Why

Tags outside the allowlist are rejected by `validateTemplate`, and malformed markup (unclosed voids, missing required attributes) fails at compile time — writing outside the list means discovering it in production instead of the editor.

## Incorrect

```typescript
// unknown tag + void element not self-closed + missing required href
const template = `<g-base><g-message><blink>Hi</blink><br><a>click</a></g-message></g-base>`
```

## Correct

```typescript
const template = `<g-base><g-message><b>Hi</b><br/><a href="https://x">click</a> <tg-spoiler>secret</tg-spoiler></g-message></g-base>`
```

## Notes

- 54 tags in 5 categories: inline (15), block/structural (24), Telegram-specific (8), media (6), forms (`input`). Constants: `ALLOWED_BLOCKS_TELEGRAM_LEGACY` (9) + `ALLOWED_BLOCKS_TELEGRAM_RICH` (45).
- Void elements must self-close: `<br/>`, `<hr/>`, `<img/>`, `<input/>`, `<tg-map/>`.
- Required attributes are enforced (`<a>` needs `href`, `<tg-emoji>` needs `emoji-id`, `<tg-map>` needs `lat`+`long`+`zoom`); value formats validated (`tg-time unix`, map ranges); anything outside a tag's attribute allowlist is rejected.
- Follows Telegram Bot API Rich Message Formatting (`BOT_API_VERSION`); `{{placeholder}}` values skip value validation.
