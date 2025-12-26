# TemplateManager

- **Type:** Class
- **Description:** Manages loading, compiling, and hot-reloading of template files.

## Constructor

### `new TemplateManager(options)`

- **Description:** Initializes the manager with file paths and watch options.
- **Params:**
  - `options.path`: `[string[]]` - Array of directory paths to scan.
  - `options.enableWatch`: `[boolean]` - Boolean to enable file watching.
  - `options.watchOptions`: `[object]` - Chokidar options.
- **Returns:** `TemplateManager` instance.
- **Example:** `const mgr = new TemplateManager({ path: ["./src/pages"], enableWatch: true });`

## Methods

### `getMessage(key, baseId?, language?, data?)`

- **Description:** Renders a text message from a template.
- **Params:**
  - `key`: `[string]` - The template key (filename).
  - `baseId`: `[string]` - The base ID (default: "default").
  - `language`: `[string]` - Language code (default: "default").
  - `data`: `[object]` - Data object for variables.
- **Returns:** `string` - The rendered message.
- **Example:** `const text = mgr.getMessage("start", "default", "en", { name: "User" });`

### `getMedia(key, baseId?, language?, data?)`

- **Description:** Renders a media object (src, caption, etc.).
- **Params:**
  - `key`: `[string]` - Template key.
  - `baseId`: `[string]` - Base ID.
  - `language`: `[string]` - Language code.
  - `data`: `[object]` - Data object.
- **Returns:** `IMediaBlock` - The rendered media object.
- **Example:** `const media = mgr.getMedia("promo", "video1", "en");`

### `getKeyboard(key, baseId?, language?, type?, data?)`

- **Description:** Renders a compiled keyboard (internal structure).
- **Params:**
  - `key`: `[string]` - Template key.
  - `baseId`: `[string]` - Base ID.
  - `language`: `[string]` - Language code.
  - `type`: `[string]` - Keyboard type id (e.g. from `<keyboard id="type">`).
  - `data`: `[object]` - Data object.
- **Returns:** `string[]` - Array of rendered button labels.
- **Example:** `const currentKb = mgr.getKeyboard("menu", "main", "en", "default");`

### `has(key)`

- **Description:** Checks if a template is loaded.
- **Params:**
  - `key`: `[string]` - Template key (filename without extension).
- **Returns:** `boolean`
- **Example:** `if (mgr.has("start")) ...`

### `write(filename, template)`

- **Description:** Writes content to a template file and updates the cache.
- **Params:**
  - `filename`: `[string]` - Target filename.
  - `template`: `[string]` - Content string.
- **Returns:** `Promise<boolean | null>` - Success status.
- **Example:** `await mgr.write("new.html", "<message>Hi</message>");`

### `destroy()`

- **Description:** Stops file watchers and cleans up.
- **Params:** None.
- **Returns:** `Promise<void>`
- **Example:** `await mgr.destroy();`
