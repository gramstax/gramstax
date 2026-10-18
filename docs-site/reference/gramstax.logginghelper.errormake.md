---
title: "LoggingHelper.errorMake()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [LoggingHelper](./gramstax.logginghelper.md) &gt; [errorMake](./gramstax.logginghelper.errormake.md)

## LoggingHelper.errorMake() method

Log a formatted error message with optional class and function context.

**Signature:**

```typescript
errorMake(pureError: Error | unknown, constructorName?: string, funcName?: string): void;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

pureError


</td><td>

Error \| unknown


</td><td>

The error to log. Can be an `Error` object or any value.


</td></tr>
<tr><td>

constructorName


</td><td>

string


</td><td>

_(Optional)_ Class name for context. Format is `[ClassName:methodName] error`.


</td></tr>
<tr><td>

funcName


</td><td>

string


</td><td>

_(Optional)_ Method/function name. Format is `[methodName] error` if no class.


</td></tr>
</tbody></table>

**Returns:**

void

## Example


```typescript
const logger = new LoggingHelper();

try {
  throw new Error("Something went wrong");
} catch (error) {
  logger.errorMake(error, "UserService", "createUser");
  // Logs: [UserService:createUser] { "message": "Something went wrong", ... }
}
```

