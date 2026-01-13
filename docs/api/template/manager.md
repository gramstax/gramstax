> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

# TemplateManager

The `TemplateManager` class manages template loading, compilation, caching, and hot-reloading from page files.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `TemplateManager` for template management.
> - **Hot-reload:** Supports file watching for development.
> - **Sources:** Templates from static `template` property or `.tpl` files.

&nbsp;

## Constructor

### `new TemplateManager(options)`

| parameter           | type     | required | default | description             | ai_notes                                      |
| ------------------- | -------- | -------- | ------- | ----------------------- | --------------------------------------------- |
| options.path        | string[] | yes      | -       | Paths to scan for pages | Note: Typically `["src/pages"]`.              |
| options.enableWatch | boolean  | no       | `false` | Enable file watching    | Note: For development auto-reload on changes. |

| options.watchOptions | object | no | - | Chokidar watch options | **Passed to:** chokidar watcher. |

```typescript
import { TemplateManager } from "gramstax";

const tm = new TemplateManager({
  path: [join(process.cwd(), "src", "pages")],
  enableWatch: process.env.NODE_ENV === "development",
});
```

&nbsp;

## Template Sources

Templates can come from:

### 1. Static Template Property

```typescript
class MyPage extends Ctx {
  static template = `
    <base>
      <message>Hello World</message>
    </base>
  `;
}
```

### 2. External .html File

Create `my-page.html` alongside `my-page.ts`:

```html
<base>
  <message>Hello World</message>
</base>
```

&nbsp;

## Methods

### `.getMessage(key, baseId?, language?, data?)`

Get compiled message string.

| parameter | type   | required | default   | description          | ai_notes                         |
| --------- | ------ | -------- | --------- | -------------------- | -------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Template file key.               |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.       |
| language  | string | no       | "default" | Language code        | Uses `default` as fallback.      |
| data      | object | no       | -         | Template variables   | Used for template interpolation. |

- **returns: string**
- **ai_notes:** Rendered template string.

```typescript
const message = tm.getMessage("start", "default", "en", { name: "John" });
```

### `.getKeyboard(key, baseId?, language?, type?, data?)`

Get compiled keyboard labels.

| parameter | type   | required | default   | description          | ai_notes                        |
| --------- | ------ | -------- | --------- | -------------------- | ------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Source template file key.       |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.      |
| language  | string | no       | "default" | Language code        | Fallback uses `default`.        |
| type      | string | no       | "inline"  | Keyboard type        | Values are `inline`, `bottom`.  |
| data      | object | no       | -         | Template variables   | Used by template interpolation. |

- **returns: string[]**
- **ai_notes:** Button labels for selected language.

```typescript
const buttons = tm.getKeyboard("start", "default", "en", "inline");
// => ["Counter", "Help", "Settings"]
```

### `.getMedia(key, baseId?, language?, data?)`

Get compiled media data.

| parameter | type   | required | default   | description          | ai_notes                         |
| --------- | ------ | -------- | --------- | -------------------- | -------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Template file key.               |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.       |
| language  | string | no       | "default" | Language code        | Uses `default` as fallback.      |
| data      | object | no       | -         | Template variables   | Used for template interpolation. |

- **returns: IMediaBlock | undefined**
- **ai_notes:** Media payload for selected base/lang.

```typescript
const media = tm.getMedia("photo-page", "default", "en");
// => { type: "photo", src: "...", caption: "..." }
```

### `.getDescription(key, baseId?, language?, scope?, data?)`

Get command description for Telegram menu.

| parameter | type   | required | default   | description          | ai_notes                        |
| --------- | ------ | -------- | --------- | -------------------- | ------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Source template file key.       |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.      |
| language  | string | no       | "default" | Language code        | Fallback uses `default`.        |
| scope     | string | no       | "default" | Bot command scope    | Telegram command scope.         |
| data      | object | no       | -         | Template variables   | Used by template interpolation. |

- **returns: string**
- **ai_notes:** Rendered description string.

```typescript
const desc = tm.getDescription("start", "default", "en");
// => "Start the bot"
```

### `.getDescriptionLanguage(key, baseId?, scope?)`

Get available languages for a description.

- **returns: string[]**
- **ai_notes:** Languages present for scope.

### `.getDescriptionScopes(key, baseId?)`

Get available scopes for a description.

- **returns: string[]**
- **ai_notes:** Scope keys for description.

### `.has(key)`

Check if template exists.

| parameter | type   | required | description | ai_notes               |
| --------- | ------ | -------- | ----------- | ---------------------- |
| key       | string | yes      | Page name   | Template cache lookup. |

- **returns: boolean**
- **ai_notes:** True when template exists.

### `.destroy()`

Cleanup resources and close watchers.

- **returns: Promise\<void\>**
- **ai_notes:** Resolves after watchers closed.

&nbsp;

## Internal Properties

### `._map`

Map of compiled templates.

- **type: Map\<string, ICompiledTemplate\>**

### `._engine`

Reference to TemplateEngine class.

- **type: typeof TemplateEngine**

### `._watcher`

Active file watchers.

- **type: FSWatcher[]**

&nbsp;

## Hot Reload

When `enableWatch` is true:

- **File change:** Recompiles the template
- **File add:** Compiles and adds new template
- **File delete:** Removes template from cache

```typescript
const tm = new TemplateManager({
  path: [join(process.cwd(), "src", "pages")],
  enableWatch: true,
  watchOptions: {
    ignored: /node_modules/,
    persistent: true,
  },
});

// Later: cleanup
await tm.destroy();
```

&nbsp;

## Usage

```typescript
import { TemplateManager, Gramstax } from "gramstax";
import { join } from "path";

const templateManager = new TemplateManager({
  path: [
    join(process.cwd(), "src", "pages"),
    join(process.cwd(), "src", "shared-templates"),
  ],
  enableWatch: process.env.NODE_ENV !== "production",
});

// Use with Gramstax
new Gramstax({
  token: "TOKEN",
  deploy: "polling",
  templateManager,
});

// Direct usage
const message = templateManager.getMessage("welcome", "default", "en", {
  userName: "John",
  balance: 100,
});

const keyboard = templateManager.getKeyboard(
  "welcome",
  "default",
  "en",
  "inline"
);

console.log("Message:", message);
console.log("Buttons:", keyboard);
```
