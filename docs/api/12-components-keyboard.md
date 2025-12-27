# Component

Components in Gramstax are used to manage reusable UI elements and their logic. Currently, the primary focus is on keyboard components, which simplify creating multi-language functional buttons.

# ComponentKeyboard

- **Type:** Class
- **Description:** Base class for all keyboard-related components. It bridges project-specific localized data with the Gramstax template engine.

## Properties

- `data`: `[typeof DataKeyboard]` - Reference to the keyboard data class.

## Methods

### `_process(obj, params)`

- **Description:** Processes localized data objects into `<keyboard>` tags.
- **Params:**
  - `obj`: `[object]` - Localized data (keys as language codes, values as button strings).
  - `params`: `[object]` - Configuration:
    - `type`: `["inline" | "bottom"]` - Keyboard type.
    - `lang`: `[string]` - Specific language to extract.
    - `reverse`: `[boolean]` - If true, reverses button order.
- **Returns:** `string` - Generated HTML-like template string.

### `_build(key, lang?, type?)`

- **Description:** Calls a data method and wraps the result in `<keyboard>` tags.
- **Params:**
  - `key`: `[string]` - Method name in the `data` class.
  - `lang`: `[string]` - Target language.
  - `type`: `[string]` - Keyboard type.
- **Returns:** `string` - Generated HTML-like template string.
- **Example:** `ComponentKeyboard._build("home", "id", "inline")`

---

## Extension Pattern

To create a custom component, extend this class and define static methods.

### Example

```typescript
import { KeyboardData } from "~/data/keyboard";
import { ComponentKeyboard } from "gramstax";

export class KeyboardComponent extends ComponentKeyboard {
  public static data = KeyboardData;

  public static home(lang?: string, type?: string) {
    return this._build("home", lang, type);
  }
}
```

By extending this pattern, you can use these components directly in your templates via variable interpolation:

```typescript
export class MyPage extends PageBase {
  public static template = `
        <base>
            ${this.KbCom.home()}
            <message>Welcome Home!</message>
        </base>
    `;
}
```
