

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendSticker](./gramstax.e2ehelper.sendsticker.md)

## E2eHelper.sendSticker() method

Simulate a user sending a sticker message.

**Signature:**

```typescript
sendSticker(options?: IE2eUpdateOptions): Promise<IE2eApiCall[]>;
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

