# 08 - Best Practices

> Recommended patterns for Gramstax bots.

---

## Page Organization

### Extend PageBase

```typescript
// ✅ Correct
import { PageBase } from "~/base/page";
export class MyPage extends PageBase {}

// ❌ Incorrect
import { Ctx } from "gramstax";
export class MyPage extends Ctx {}
```

### Use internal()

```typescript
public async internal(edit = false) {
  const kb = this.kb()
  const data = { name: this.userFirstName }
  if (edit) await this.edit(kb, data)
  else await this.reply(kb, data)
}

public async textCommand() { await this.internal(false) }
public async callback() { await this.internal(true) }
```

---

## Templates

### Reusable blocks

```html
<base id="ikb-back">
  <keyboard type="inline">Back</keyboard>
</base>
```

### Import

```html
<base>
  <import src="start" base="ikb-back" />
  <message>Content</message>
</base>
```

### Multi-language

```html
<keyboard type="inline">Yes, No</keyboard>
<keyboard lang="id" type="inline">Ya, Tidak</keyboard>
```

---

## Error Handling

### Dedicated error page

```typescript
export class GeneralErrorPage extends PageBase {
  public async transition(source: string, error: any, isEdit: boolean) {
    console.error(`Error in ${source}:`, error);
    await this.sessionClear();
    if (isEdit) await this.edit(this.kb());
    else await this.reply(this.kb());
  }
}
```

### hookErrorPage

```typescript
public async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
  await new GeneralErrorPage(ctx).transition(listenerName, error, isEdit)
}
```

---

## Sessions

### Always clear

```typescript
public async textFree() {
  await this.processInput()
  await this.sessionClear()  // Always clear
  await this.reply(this.kb())
}
```

### Cancel options

```typescript
public async callbackPayload() {
  if (this.callbackDataPayload === `cancel`) {
    await this.sessionClear()
    await new StartPage(this).transition(true)
  }
}
```

### Validate

```typescript
public async textFree() {
  if (!this.validateSessionTextFree()) return null
  // Process...
}
```

---

## Performance

### Keyboard caching

```typescript
public kb() {
  return this.inlineKeyboard(
    (kb, arr) => kb.text(arr[0]!, this.data.callbackData()),
    { cache: true }
  )
}
```

### Edit over delete+reply

```typescript
// ✅ Preferred
await this.edit(this.kb(), data);

// Only when needed (media type change)
await this.delete();
await this.reply(this.kb(), data);
```

---

## Keyboards

### Keep callback data short

Telegram limit: 64 bytes.

```typescript
// ✅ Good
this.data.callbackData("I"); // "counter:I"

// ❌ Bad
this.data.callbackData(veryLongUUID);
```

---

## Code Organization

### Path aliases

```json
{ "paths": { "~/*": ["./src/*"] } }
```

```typescript
import { PageBase } from "~/base/page";
```

### Separate business logic

```typescript
// services/wallet.ts
export class WalletService {
  static async create(userId: number, name: string) { ... }
}

// pages/wallet-create.ts
const wallet = await WalletService.create(this.userId, this.msgText)
```

---

## Summary

| Category    | Rule                      |
| ----------- | ------------------------- |
| Pages       | Extend PageBase           |
| Pages       | Use internal() pattern    |
| Templates   | Create reusable blocks    |
| Templates   | Multi-language support    |
| Sessions    | Always clear              |
| Sessions    | Validate in free handlers |
| Performance | Use edit over reply       |
| Keyboards   | Short callback data       |

---

## Navigation

| Previous                           | Next                     |
| ---------------------------------- | ------------------------ |
| [07-examples.md](./07-examples.md) | [README.md](./README.md) |
