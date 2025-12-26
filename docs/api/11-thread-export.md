# ThreadExport

- **Type:** Utility Class
- **Description:** Helper for consolidating main and sub thread implementations into a single file with type-safe proxying.

## Methods

### `static init(options)`

- **Description:** Dual-purpose initialization for both Main and Sub thread contexts.
- **Params:**
  - `options`: `[object]` - Configuration for export.
    - `path`: `[string]` - Usually `__filename` or `import.meta.url`.
    - `CSub`: `[class]` - Sub thread class definition.
    - `CMain`: `[class]` - Optional Main thread class override.
    - `wrap`: `[function]` - Mapping function for proxy methods.
- **Returns:** `TWrap & { launch: Function }`
- **Example:**

```typescript
export const Job = ThreadExport.init({
  path: __filename,
  CSub: MySub,
  wrap: (main) => ({
    doTask: () => main.sendRequest("doTask", []),
  }),
});
```
