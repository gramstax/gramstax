> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

# ComponentKeyboard

The `ComponentKeyboard` class provides static methods for generating keyboard template blocks from `DataKeyboard` definitions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `ComponentKeyboard` static methods.
> - **Dependency:** Requires `DataKeyboard` to be set via `ComponentKeyboard.data`.
> - **Output:** Generates HTML-like `<keyboard>` blocks for template engine.

&nbsp;

## Static Properties

### `.data`

Reference to the `DataKeyboard` class containing keyboard definitions.

- **type: typeof DataKeyboard**
- **required:** Must be set before using `_build()`.

```typescript
import { ComponentKeyboard, DataKeyboard } from "gramstax";

class MyKeyboards extends DataKeyboard {
  static backNext() {
    return { en: "Back, Next", id: "Kembali, Lanjut" };
  }
}

ComponentKeyboard.data = MyKeyboards;
```

&nbsp;

## Static Methods

### `._process(obj, params)`

Generate keyboard template blocks from an object of language-keyed values.

| parameter      | type    | required | default    | description               | ai_notes                                  |
| -------------- | ------- | -------- | ---------- | ------------------------- | ----------------------------------------- |
| obj            | object  | yes      | -          | Object with language keys | Structure is `{ en: "...", id: "..." }`.  |
| params.type    | string  | no       | `"inline"` | Keyboard type             | Values are `"inline"` or `"bottom"`.      |
| params.lang    | string  | no       | -          | Target language           | If set, returns single language block.    |
| params.reverse | boolean | no       | -          | Reverse button order      | If true, reverses comma-separated labels. |

- **returns: string**
- **ai_notes:** Returns HTML-like `<keyboard>` block(s) as string.

```typescript
const obj = { en: "Back, Next", id: "Kembali, Lanjut" };

// All languages
ComponentKeyboard._process(obj, { type: "inline" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard> <keyboard type="inline" lang="id">Kembali, Lanjut</keyboard>`

// Single language
ComponentKeyboard._process(obj, { type: "inline", lang: "en" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard>`

// Reversed
ComponentKeyboard._process(obj, { type: "inline", reverse: true });
// => `<keyboard type="inline" lang="en">Next, Back</keyboard> ...`
```

&nbsp;

### `._build(key, lang?, type?)`

Build keyboard blocks by calling a method from the linked `DataKeyboard`.

| parameter | type   | required | default    | description                 | ai_notes                               |
| --------- | ------ | -------- | ---------- | --------------------------- | -------------------------------------- |
| key       | string | yes      | -          | Method name in DataKeyboard | Must exist or throws.                  |
| lang      | string | no       | -          | Target language             | If set, returns single language block. |
| type      | string | no       | `"inline"` | Keyboard type               | Values are `"inline"` or `"bottom"`.   |

- **returns: string**
- **ai_notes:** Returns keyboard block string.
- **throws:** Error if `data` not set or method not found.

```typescript
// Assuming ComponentKeyboard.data = MyKeyboards with backNext() method

ComponentKeyboard._build("backNext");
// => '<keyboard type="inline" lang="en">Back, Next</keyboard> ...'

ComponentKeyboard._build("backNext", "en", "bottom");
// => '<keyboard type="bottom" lang="en">Back, Next</keyboard>'
```

&nbsp;

## Usage

```typescript
import { ComponentKeyboard, DataKeyboard, Ctx } from "gramstax";

// ./data/keyboard.ts
class KeyboardD extends DataKeyboard {
  static navigation() {
    return {
      en: "Back, Home, Next",
      id: "Kembali, Beranda, Lanjut",
    };
  }
}

// ./components/keyboard.ts
export class KeyboardC extends ComponentKeyboard {
  static data = KeyboardD;
  static navigation(lang?: string, type?: string) {
    return this._build(`navigation`, lang, type);
  }
}

// ./base/page.ts
export class PageBase extends Ctx {
  static kbc = KeyboardC;
  static kbd = KeyboardC.data;
}

// ./pages/my.ts
// Use in page template
export class MyPage extends PageBase {
  static template = `
    <base>
      ${this.kbc.navigation()}
      <message>Choose an option</message>
    </base>
  `;
}
```
