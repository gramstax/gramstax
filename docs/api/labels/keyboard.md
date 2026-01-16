> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 12:24:00

> - **Framework Version:** v0.5.2

# LabelKeyboard

The `LabelKeyboard` class provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `LabelKeyboard` static utility methods.
> - **Usage:** Used as base class for user-defined keyboard data classes.
> - **Purpose:** Provides button order manipulation for multi-language keyboards.

&nbsp;

## Static Methods

### `._reverse(input)`

Reverse the order of comma-separated button labels.

| parameter | type   | required | description                                                          |
| --------- | ------ | -------- | -------------------------------------------------------------------- |
| input     | string | yes      | Comma-separated button labels. Escaped commas (`\\,`) are preserved. |

- **returns: string**
- **description:** Reversed comma-separated labels.

```typescript
import { LabelKeyboard } from "gramstax";

const reversed = LabelKeyboard._reverse("Back, Next, Submit");
// => "Submit, Next, Back"

// Escaped commas are preserved
const preserved = LabelKeyboard._reverse("Option A\\, B, Option C");
// => "Option C, Option A\\, B"
```

&nbsp;

### `._reverseObj(input)`

Reverse button order for all languages in an object.

| parameter | type   | required | description                                                                      |
| --------- | ------ | -------- | -------------------------------------------------------------------------------- |
| input     | object | yes      | Object with language keys and button values. Applies `_reverse()` to each value. |

- **returns: object**
- **description:** Returns object with reversed labels.

```typescript
const reversed = LabelKeyboard._reverseObj({
  en: "Back, Next",
  id: "Kembali, Lanjut",
});
// => { en: "Next, Back", id: "Lanjut, Kembali" }
```

&nbsp;

### `._build(lang, reverse, obj)`

Build keyboard string with optional language selection and reversal.

| parameter | type    | required | description                                                               |
| --------- | ------- | -------- | ------------------------------------------------------------------------- |
| lang      | string  | no       | Target language code. If provided, returns only that language value.      |
| reverse   | boolean | no       | Whether to reverse button order. If true, applies `_reverse()` to result. |
| obj       | object  | yes      | Object with language keys. Structure is `{ en: "...", id: "...", ... }`.  |

- **returns: string | object**
- **description:** Returns string if `lang` provided, object otherwise.

```typescript
const keyboards = {
  en: "Back, Next",
  id: "Kembali, Lanjut",
};

// Get specific language
LabelKeyboard._build("en", false, keyboards);
// => "Back, Next"

// Get specific language reversed
LabelKeyboard._build("en", true, keyboards);
// => "Next, Back"

// Get all languages
LabelKeyboard._build(undefined, false, keyboards);
// => { en: "Back, Next", id: "Kembali, Lanjut" }
```

&nbsp;

## Usage

Extend `LabelKeyboard` to define reusable keyboard configurations:

```typescript
import { LabelKeyboard } from "gramstax";

export class KeyboardLabel extends LabelKeyboard {
  static backNext(lang?: string) {
    return this._build(lang, false, {
      en: "Back, Next",
      id: "Kembali, Lanjut",
    });
  }

  static confirmCancel(lang?: string) {
    return this._build(lang, false, {
      en: "Confirm, Cancel",
      id: "Konfirmasi, Batal",
    });
  }
}
```
