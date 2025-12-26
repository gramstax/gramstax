# CacheExternal

- **Type:** Class
- **Description:** Extends class `Keyv` to provide a consistent caching interface.

## Constructor

### `new CacheExternal(url, namespace?, ttl?, more?)`

- **Description:** Creates a new cache instance connected to the specified storage (memory or redis).
- **Params:**
  - `url`: `[string]` - Connection string (`memory` or `redis://...`).
  - `namespace`: `[string]` - Optional key prefix (namespace).
  - `ttl`: `[number]` - Optional default time-to-live in milliseconds.
  - `more`: `[object]` - Additional options, including `forceStore` to inject a custom store.
- **Returns:** `CacheExternal` instance.
- **Example:** `const cache = new CacheExternal("redis://localhost:6379");`

## Methods

### `get(key)`

- **Description:** Retrieves a value by its key.
- **Params:**
  - `key`: `[string]` - The key of the item to retrieve.
- **Returns:** `Promise<any>` - The stored value or `undefined`.
- **Example:** `const val = await cache.get("session:123");`

### `set(key, value, ttl?)`

- **Description:** Stores a value in the cache.
- **Params:**
  - `key`: `[string]` - The key to store the value under.
  - `value`: `[any]` - The value to store.
  - `ttl`: `[number]` - Optional time-to-live in milliseconds for this specific item.
- **Returns:** `Promise<true>` - Resolves to true on success.
- **Example:** `await cache.set("user:1", { name: "Alice" }, 1000);`

### `delete(key)`

- **Description:** Deletes a specific item from the cache.
- **Params:**
  - `key`: `[string]` - The key of the item to delete.
- **Returns:** `Promise<boolean>` - True if the item existed and was deleted.
- **Example:** `await cache.delete("temp_data");`

### `clear()`

- **Description:** Clears all items in the current namespace.
- **Params:** None
- **Returns:** `Promise<void>`
- **Example:** `await cache.clear();`
