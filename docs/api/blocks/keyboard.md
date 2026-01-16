> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 12:24:00

> - **Framework Version:** v0.5.0

# BlockKeyboard

The `BlockKeyboard` class provides static methods for generating keyboard template blocks from `LabelKeyboard` definitions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `BlockKeyboard` static methods.
> - **Dependency:** Requires `LabelKeyboard` to be set via `BlockKeyboard.label`.
> - **Output:** Generates HTML-like `<keyboard>` blocks for template engine.

&nbsp;

## Static Properties

### `.label`

Reference to the `LabelKeyboard` class containing keyboard definitions.

- **type: typeof LabelKeyboard**
- **required:** Must be set before using `_build()`.

```typescript
import { BlockKeyboard, LabelKeyboard } from "gramstax";

class KeyboardLabel extends LabelKeyboard {
  static backNext(lang?: string) {
    return this._build(lang, false, {
      en: "Back, Next",
      id: "Kembali, Lanjut",
    });
  }
}

class KeyboardBlock extends BlockKeyboard {
  static label = KeyboardLabel;
}
```

&nbsp;

## Static Methods

### `._process(obj, params)`

Generate keyboard template blocks from an object of language-keyed values.

| parameter      | type    | required | default    | description                                                         |
| -------------- | ------- | -------- | ---------- | ------------------------------------------------------------------- |
| obj            | object  | yes      | -          | Object with language keys. Structure is `{ en: "...", id: "..." }`. |
| params.type    | string  | no       | `"inline"` | Keyboard type. Values are `"inline"` or `"bottom"`.                 |
| params.lang    | string  | no       | -          | Target language. If set, returns single language block.             |
| params.reverse | boolean | no       | -          | Reverse button order. If true, reverses comma-separated labels.     |

- **returns: string**
- **description:** Returns HTML-like `<keyboard>` block(s) as string.

```typescript
const obj = { en: "Back, Next", id: "Kembali, Lanjut" };

// All languages
BlockKeyboard._process(obj, { type: "inline" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard> <keyboard type="inline" lang="id">Kembali, Lanjut</keyboard>`

// Single language
BlockKeyboard._process(obj, { type: "inline", lang: "en" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard>`

// Reversed
BlockKeyboard._process(obj, { type: "inline", reverse: true });
// => `<keyboard type="inline" lang="en">Next, Back</keyboard> ...`
```

&nbsp;

### `._build(key, lang?, type?)`

Build keyboard blocks by calling a method from the linked `LabelKeyboard`.

| parameter | type   | required | default    | description                                             |
| --------- | ------ | -------- | ---------- | ------------------------------------------------------- |
| key       | string | yes      | -          | Method name in LabelKeyboard. Must exist or throws.     |
| lang      | string | no       | -          | Target language. If set, returns single language block. |
| type      | string | no       | `"inline"` | Keyboard type. Values are `"inline"` or `"bottom"`.     |

- **returns: string**
- **description:** Returns keyboard block string.

- **throws:** Error if `data` not set or method not found.

```typescript
// Assuming BlockKeyboard.label = MyKeyboards with backNext() method

BlockKeyboard._build("backNext");
// => '<keyboard type="inline" lang="en">Back, Next</keyboard> ...'

BlockKeyboard._build("backNext", "en", "bottom");
// => '<keyboard type="bottom" lang="en">Back, Next</keyboard>'
```

&nbsp;

## Usage

```typescript
import { BlockKeyboard, LabelKeyboard, Ctx } from "gramstax";

// ./labels/keyboard.ts
class KeyboardLabel extends LabelKeyboard {
  static navigation(lang?: string) {
    return this._build(lang, false, {
      en: "Back, Home, Next",
      id: "Kembali, Beranda, Lanjut",
    });
  }
}

// ./blocks/keyboard.ts
export class KeyboardBlock extends BlockKeyboard {
  static label = KeyboardLabel;
  static navigation(lang?: string, type?: string) {
    return this._build(`navigation`, lang, type);
  }
}

// ./base/page.ts
export class PageBase extends Ctx {
  static kbk = KeyboardBlock;
  static kbl = KeyboardBlock.label;
}

// ./pages/my.ts
// Use in page template
export class MyPage extends PageBase {
  static template = `
    <base>
      ${this.kbk.navigation()}
      <message>Choose an option</message>
    </base>
  `;
}
```
