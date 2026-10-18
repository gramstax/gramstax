

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [LoggingHelper](./gramstax.logginghelper.md) &gt; [timeLog](./gramstax.logginghelper.timelog.md)

## LoggingHelper.timeLog() method

Log a checkpoint with elapsed time without ending the timer.

**Signature:**

```typescript
timeLog(label: string, message?: string): void;
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

label


</td><td>

string


</td><td>

The timer label to checkpoint.


</td></tr>
<tr><td>

message


</td><td>

string


</td><td>

_(Optional)_ Optional custom message for this checkpoint.


</td></tr>
</tbody></table>

**Returns:**

void

## Example


```typescript
const logger = new LoggingHelper();

logger.time("data-processing", "Starting data pipeline");
// ... step 1 ...
logger.timeLog("data-processing", "Step 1: Data loaded");
// Logs: (245ms) data-processing: Step 1: Data loaded
// ... step 2 ...
logger.timeLog("data-processing", "Step 2: Data transformed");
// Logs: (589ms) data-processing: Step 2: Data transformed
// ... step 3 ...
logger.timeEnd("data-processing", "Pipeline completed");
// Logs: (1234ms) data-processing: Pipeline completed
```

