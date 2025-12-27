# Data

The `Data` structure in Gramstax is designed to centralize localized content and processing logic for UI components. It decouple the actual strings from the component logic.

## DataKeyboard

- **Type:** Class
- **Description:** Base class for localized keyboard content. Provides utilities for string manipulation and language selection.

### Methods

### `_reverse(input)`

- **Description:** Reverses a comma-separated string of buttons.
- **Params:**
  - `input`: `[string]` - Comma-separated labels.
- **Returns:** `string` - Reversed string.
- **Example:** `"A, B" -> "B, A"`

### `_reverseObj(input)`

- **Description:** Reverses all strings within a localized object.
- **Params:**
  - `input`: `[object]` - Localized data object.
- **Returns:** `object` - Object with reversed values.

### `_build(lang, reverse, obj)`

- **Description:** Selects and optionally reverses localized data.
- **Params:**
  - `lang`: `[string | undefined]` - Target language.
  - `reverse`: `[boolean | undefined]` - Whether to reverse the result.
  - `obj`: `[object]` - The localized data object.
- **Returns:** `string | object` - Extracted content.

---

## Extension Pattern

Extend this class to define localized button sets.

```typescript
export class KeyboardData extends DataKeyboard {
  public static home(lang?: string) {
    return this._build(lang, false, {
      default: ".. Home",
      id: ".. Beranda",
    });
  }
}
```
