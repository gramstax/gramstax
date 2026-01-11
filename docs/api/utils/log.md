# LoggingUtils

The `LoggingUtils` class extends [LoggingPretty](https://www.npmjs.com/package/logging-pretty) to provide enhanced logging functionality.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `LoggingUtils` class and the exported `log` singleton.
> - **Inheritance:** Extends `LoggingPretty` with additional helper methods.

&nbsp;

## Constructor

### `new LoggingUtils(options?)`

| parameter | type   | required | default | description                       | ai_notes                                       |
| --------- | ------ | -------- | ------- | --------------------------------- | ---------------------------------------------- |
| options   | object | no       | -       | LoggingPretty constructor options | **Passed through:** to parent `LoggingPretty`. |

```typescript
import { LoggingUtils } from "gramstax";

const logger = new LoggingUtils();
```

&nbsp;

## Methods

### `.errorMake(error, constructorName?, funcName?)`

Log a formatted error message with optional class and function context.

| parameter       | type   | required | default | description            | ai_notes                                      |
| --------------- | ------ | -------- | ------- | ---------------------- | --------------------------------------------- |
| error           | any    | yes      | -       | The error to log       | **Stringified:** using `String(error)`.       |
| constructorName | any    | no       | -       | Class name for context | **Format:** `[ClassName:methodName] error`.   |
| funcName        | string | no       | -       | Method/function name   | **Format:** `[methodName] error` if no class. |

- **returns: void**

```typescript
const logger = new LoggingUtils();

try {
  throw new Error("Something went wrong");
} catch (error) {
  logger.errorMake(error, "UserService", "createUser");
  // Logs: [UserService:createUser] Error: Something went wrong
}
```

&nbsp;

## Exported Singleton

### `log`

A pre-instantiated `LoggingUtils` instance for convenience.

```typescript
import { log } from "gramstax";

log.info("Application started");
log.debug("Debug message");
log.warn("Warning message");
log.error("Error message");
log.success("Success message");
```

&nbsp;

## Inherited Methods

All methods from [LoggingPretty](https://www.npmjs.com/package/logging-pretty) are available:

- `.info(message)` - Log info level message
- `.debug(message)` - Log debug level message
- `.warn(message)` - Log warning level message
- `.error(message)` - Log error level message
- `.success(message)` - Log success level message
