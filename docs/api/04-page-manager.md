# PageManager

- **Type:** Class (Static)
- **Description:** Static utility for dynamically loading Page classes from files.

## Methods

### `_getFile(mod, path, redactedTemplate, positionModule)`

- **Description:** Internal helper to extract the Page class from a loaded module. Checks for validity and optionally clears the template string to save memory.
- **Params:**
  - `mod`: `[object]` - The loaded module object.
  - `path`: `[string]` - File path (for error reporting).
  - `redactedTemplate`: `[boolean]` - If true, sets `Page.template` to undefined.
  - `positionModule`: `[number]` - Index of the export to use (default 0).
- **Returns:** `typeof Ctx` (The Page class).
- **Example:** `const Page = PageManager._getFile(module, "start.ts");`

### `getFilePath()`

- **Description:** Returns the default absolute path to the `src/pages` directory.
- **Params:** None.
- **Returns:** `string` - Absolute path.
- **Example:** `const pagesDir = PageManager.getFilePath();`

### `getFileSync(path?, redactedTemplate?, positionModule?)`

- **Description:** Synchronously requires a file and returns the Page class.
- **Params:**
  - `path`: `[string]` - Optional absolute file path. Defaults to `getFilePath()`.
  - `redactedTemplate`: `[boolean]` - (default true).
  - `positionModule`: `[number]` - Export index (default 0).
- **Returns:** `typeof Ctx`
- **Example:** `const Page = PageManager.getFileSync("/path/to/page.ts");`

### `getFile(path?, redactedTemplate?, positionModule?)`

- **Description:** Asynchronously imports a file (using dynamic import with cache busting) and returns the Page class.
- **Params:**
  - `path`: `[string]` - Optional absolute file path.
  - `redactedTemplate`: `[boolean]` - (default true).
  - `positionModule`: `[number]` - Export index (default 0).
- **Returns:** `Promise<typeof Ctx>`
- **Example:** `const Page = await PageManager.getFile("/path/to/page.ts");`

### `getFileManySync(path?, redactedTemplate?, positionModule?)`

- **Description:** Synchronously scans a directory and loads all Page classes found within it.
- **Params:**
  - `path`: `[string]` - Directory path (default `src/pages`).
  - `redactedTemplate`: `[boolean]` - (default true).
  - `positionModule`: `[number]` - Export index (default 0).
- **Returns:** `Array<{ path: string, page: typeof Ctx }>`
- **Example:** `const pages = PageManager.getFileManySync();`
