

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendCallbackQuery](./gramstax.e2ehelper.sendcallbackquery.md)

## E2eHelper.sendCallbackQuery() method

Simulate a user pressing an inline keyboard button (callback query).

**Signature:**

```typescript
sendCallbackQuery(data: string, options?: IE2eCallbackQueryOptions): Promise<IE2eApiCall[]>;
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

data


</td><td>

string


</td><td>

The `callback_data` string from the pressed button.


</td></tr>
<tr><td>

options


</td><td>

[IE2eCallbackQueryOptions](./gramstax.ie2ecallbackqueryoptions.md)


</td><td>

_(Optional)_ Callback ID, message text, user, chat, and response options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update.

