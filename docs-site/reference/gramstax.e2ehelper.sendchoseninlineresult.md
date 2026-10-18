

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendChosenInlineResult](./gramstax.e2ehelper.sendchoseninlineresult.md)

## E2eHelper.sendChosenInlineResult() method

Simulate a user choosing a result from an inline query.

**Signature:**

```typescript
sendChosenInlineResult(resultId: string, query: string, options?: IE2eUpdateOptions): Promise<IE2eApiCall[]>;
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

resultId


</td><td>

string


</td><td>

The chosen result ID.


</td></tr>
<tr><td>

query


</td><td>

string


</td><td>

The inline query text.


</td></tr>
<tr><td>

options


</td><td>

[IE2eUpdateOptions](./gramstax.ie2eupdateoptions.md)


</td><td>

_(Optional)_ User, chat, and response options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update.

