# 05 - Session Management

> Session state for multi-step flows.

---

## Table of Contents

- [Basic Operations](#basic-operations)
- [Session Methods](#session-methods)
- [Validation](#validation)
- [Multi-Step Example](#multi-step-example)

---

## Basic Operations

```typescript
await this.sessionSet("method", { step: 1 }); // Set
const session = await this.sessionGet(); // Get
await this.sessionClear(); // Clear
```

---

## Session Methods

### Set Session

| Method                       | Enables             |
| ---------------------------- | ------------------- |
| `sessionToTextFree()`        | `textFree()`        |
| `sessionToPhotoFree()`       | `photoFree()`       |
| `sessionToDocumentFree()`    | `documentFree()`    |
| `sessionToCallback()`        | `callback()`        |
| `sessionToCallbackPayload()` | `callbackPayload()` |

### With Parameters

```typescript
await this.sessionToTextFree({ step: "1", walletId: "abc" });

// In handler
const step = this.session.params?.step;
const walletId = this.session.params?.walletId;
```

---

## Validation

```typescript
public async textFree() {
  if (!this.validateSessionTextFree()) {
    return null  // Continue to next handler
  }
  // Process...
}
```

---

## Multi-Step Example

```typescript
export class WalletCreatePage extends Ctx {
  public static data = this.buildData((isCancel: string = ``) => isCancel);

  public kb(baseId?: string) {
    return this.inlineKeyboard(
      (kb, arr) => {
        if (!baseId) {
          return kb.text(arr[0]!, this.data.callbackData(`yes`));
        }
        return kb.text(arr[0]!, `...`);
      },
      { baseId }
    );
  }

  // Step 1: Ask for name
  public async callback() {
    await this.sessionToTextFree({ step: "1" });
    await this.edit(this.kb(), {}, "step1");
  }

  // Cancel handler
  public async callbackPayload() {
    if (this.callbackDataPayload === "yes") {
      await this.sessionClear();
      await new StartPage(this).transition();
    }
  }

  // Steps 2-3: Receive input
  public async textFree() {
    const step = this.session.params?.step;

    if (step === "1") {
      const name = this.msgText;
      await this.sessionToTextFree({ step: "2", name });
      await this.reply(this.kb(), {}, "step2");
      return;
    }

    if (step === "2") {
      const { name } = this.session.params;
      const address = this.msgText;

      await this.saveWallet(name, address);

      const base = `success`;
      await this.sessionClear();
      await this.reply(this.kb(base), { name, address }, base);
    }
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Cancel</keyboard>
    </base>

    <base id="step1">
      <message>Please enter wallet name:</message>
    </base>

    <base id="step2">
      <message>Please enter wallet address:</message>
    </base>

    <base id="success">
      <keyboard type="inline">Back</keyboard>
      <message>
        Wallet created!
        Name: {{name}}
        Address: {{address}}
      </message>
    </base>
  `;
}
```

---

## Best Practices

1. **Always clear** after completion: `await this.sessionClear()`
2. **Cancel options**: Handle cancel via `callbackPayload()`
3. **Minimal data**: Store IDs, not objects
4. **Validate**: Use `validateSession*()` in free handlers

---

## Navigation

| Previous                                       | Next                                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| [04-routing-system.md](./04-routing-system.md) | [06-project-structure.md](./06-project-structure.md) |
