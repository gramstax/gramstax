# LoggingUtils

- **Type:** Class
- **Description:** Extends `LoggingPretty` to provide enhanced logging capabilities. A default singleton instance `log` is exported for convenience.

## Constructor

### `new LoggingUtils(options?)`

- **Description:** Initializes the logger.
- **Params:**
  - `options`: `[object]` - Configuration options inherited from LoggingPretty.
- **Returns:** `LoggingUtils` instance.
- **Example:** `const log = new LoggingUtils();`

## Methods

### `errorMake(error, constructorOrName?, funcName?)`

- **Description:** Formats and logs an error with context information (class name, function name).
- **Params:**
  - `error`: `[any]` - The error object or message.
  - `constructorOrName`: `[any]` - The class instance, constructor, or name string.
  - `funcName`: `[string]` - The name of the function where the error occurred.
- **Returns:** `void`
- **Example:** `log.errorMake(e, this, "methodName");`
