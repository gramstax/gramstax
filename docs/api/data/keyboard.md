# DataKeyboard

The `DataKeyboard` class provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `DataKeyboard` static utility methods.
> - **Usage:** Used as base class for user-defined keyboard data classes.
> - **Purpose:** Provides button order manipulation for multi-language keyboards.

&nbsp;

## Static Methods

### `._reverse(input)`

Reverse the order of comma-separated button labels.

| parameter | type   | required | description                   | ai_notes                                |
| --------- | ------ | -------- | ----------------------------- | --------------------------------------- |
| input     | string | yes      | Comma-separated button labels | **Escaped commas:** `\,` are preserved. |

- **returns: string**

```typescript
import { DataKeyboard } from "gramstax";

const reversed = DataKeyboard._reverse("Back, Next, Submit");
// => "Submit, Next, Back"

// Escaped commas are preserved
const preserved = DataKeyboard._reverse("Option A\\, B, Option C");
// => "Option C, Option A\\, B"
```

&nbsp;

### `._reverseObj(input)`

Reverse button order for all languages in an object.

| parameter | type   | required | description                                 | ai_notes                                 |
| --------- | ------ | -------- | ------------------------------------------- | ---------------------------------------- |
| input     | object | yes      | Object with language keys and button values | **Applied:** `_reverse()` to each value. |

- **returns: object**

```typescript
const reversed = DataKeyboard._reverseObj({
  en: "Back, Next",
  id: "Kembali, Lanjut",
});
// => { en: "Next, Back", id: "Lanjut, Kembali" }
```

&nbsp;

### `._build(lang, reverse, obj)`

Build keyboard string with optional language selection and reversal.

| parameter | type    | required | description                     | ai_notes                                             |
| --------- | ------- | -------- | ------------------------------- | ---------------------------------------------------- |
| lang      | string  | no       | Target language code            | **If provided:** returns only that language's value. |
| reverse   | boolean | no       | Whether to reverse button order | **If true:** applies `_reverse()` to result.         |
| obj       | object  | yes      | Object with language keys       | **Structure:** `{ en: "...", id: "...", ... }`.      |

- **returns: string | object**
- **ai_notes:** Returns string if `lang` provided, object otherwise.

```typescript
const keyboards = {
  en: "Back, Next",
  id: "Kembali, Lanjut",
};

// Get specific language
DataKeyboard._build("en", false, keyboards);
// => "Back, Next"

// Get specific language reversed
DataKeyboard._build("en", true, keyboards);
// => "Next, Back"

// Get all languages
DataKeyboard._build(undefined, false, keyboards);
// => { en: "Back, Next", id: "Kembali, Lanjut" }
```

&nbsp;

## Usage Example

Extend `DataKeyboard` to define reusable keyboard configurations:

```typescript
import { DataKeyboard } from "gramstax";

export class MyKeyboards extends DataKeyboard {
  static backNext() {
    return {
      en: "Back, Next",
      id: "Kembali, Lanjut",
    };
  }

  static confirmCancel() {
    return {
      en: "Confirm, Cancel",
      id: "Konfirmasi, Batal",
    };
  }
}
```
