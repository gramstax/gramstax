

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [LoggingHelper](./gramstax.logginghelper.md)

## LoggingHelper class

Extends [LoggingPretty](https://www.npmjs.com/package/logging-pretty) to provide enhanced logging functionality.

**Signature:**

```typescript
declare class LoggingHelper extends LoggingPretty 
```
**Extends:** LoggingPretty

## Remarks

Inherits all methods from `LoggingPretty` including `info()`, `debug()`, `warn()`, `error()`, and `success()`. Adds helper methods for formatted error logging with class/function context and timing measurements.

## Example


```typescript
import { LoggingHelper, log } from "gramstax";

// Use the singleton
log.info("Application started");

// Time measurement
log.time("operation", "Starting database query");
// ... do work ...
log.timeEnd("operation", "Query completed");
// Output: (245ms) operation: Query completed

// Or create a new instance
const logger = new LoggingHelper();
logger.errorMake(new Error("Oops"), "Worker", "init");
```

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[\_formatErrorObj(pureError)](./gramstax.logginghelper._formaterrorobj.md)


</td><td>


</td><td>

Format an error object to a JSON string.


</td></tr>
<tr><td>

[errorMake(pureError, constructorName, funcName)](./gramstax.logginghelper.errormake.md)


</td><td>


</td><td>

Log a formatted error message with optional class and function context.


</td></tr>
<tr><td>

[time(label)](./gramstax.logginghelper.time.md)


</td><td>


</td><td>

Start a timer with a custom label.


</td></tr>
<tr><td>

[timeActive()](./gramstax.logginghelper.timeactive.md)


</td><td>


</td><td>

Get all active timer labels.


</td></tr>
<tr><td>

[timeCheck(label)](./gramstax.logginghelper.timecheck.md)


</td><td>


</td><td>

Get the elapsed time for a running timer without ending it.


</td></tr>
<tr><td>

[timeClear()](./gramstax.logginghelper.timeclear.md)


</td><td>


</td><td>

Clear all active timers.


</td></tr>
<tr><td>

[timeEnd(label, message)](./gramstax.logginghelper.timeend.md)


</td><td>


</td><td>

End a timer and log the elapsed time with an optional custom message.


</td></tr>
<tr><td>

[timeLog(label, message)](./gramstax.logginghelper.timelog.md)


</td><td>


</td><td>

Log a checkpoint with elapsed time without ending the timer.


</td></tr>
</tbody></table>

