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

| parameter            | type     | required | default | description             | ai_notes                                     |
| -------------------- | -------- | -------- | ------- | ----------------------- | -------------------------------------------- |
| options.path         | string[] | yes      | -       | Paths to scan for pages | **Typically:** `["src/pages"]`.              |
| options.enableWatch  | boolean  | no       | `false` | Enable file watching    | **For development:** auto-reload on changes. |
| options.watchOptions | object   | no       | -       | Chokidar watch options  | **Passed to:** chokidar watcher.             |

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
  static template = /*jsx*/ `
    <base>
      <message>Hello World</message>
    </base>
  `;
}
```

### 2. External .tpl File

Create `my-page.tpl` alongside `my-page.ts`:

```jsx
<base>
  <message>Hello World</message>
</base>
```

&nbsp;

## Methods

### `.getMessage(key, baseId?, language?, data?)`

Get compiled message string.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| data      | object | no       | -           | Template variables   |

- **returns: string**

```typescript
const message = tm.getMessage("start", "default", "en", { name: "John" });
```

### `.getKeyboard(key, baseId?, language?, type?, data?)`

Get compiled keyboard labels.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| type      | string | no       | `"inline"`  | Keyboard type        |
| data      | object | no       | -           | Template variables   |

- **returns: string[]**

```typescript
const buttons = tm.getKeyboard("start", "default", "en", "inline");
// => ["Counter", "Help", "Settings"]
```

### `.getMedia(key, baseId?, language?, data?)`

Get compiled media data.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| data      | object | no       | -           | Template variables   |

- **returns: IMediaBlock | undefined**

```typescript
const media = tm.getMedia("photo-page", "default", "en");
// => { type: "photo", src: "...", caption: "..." }
```

### `.getDescription(key, baseId?, language?, scope?, data?)`

Get command description for Telegram menu.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| scope     | string | no       | `"default"` | Bot command scope    |
| data      | object | no       | -           | Template variables   |

- **returns: string**

```typescript
const desc = tm.getDescription("start", "default", "en");
// => "Start the bot"
```

### `.getDescriptionLanguage(key, baseId?, scope?)`

Get available languages for a description.

- **returns: string[]**

### `.getDescriptionScopes(key, baseId?)`

Get available scopes for a description.

- **returns: string[]**

### `.has(key)`

Check if template exists.

| parameter | type   | required | description |
| --------- | ------ | -------- | ----------- |
| key       | string | yes      | Page name   |

- **returns: boolean**

### `.destroy()`

Cleanup resources and close watchers.

- **returns: Promise\<void\>**

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

## Complete Example

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
