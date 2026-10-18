

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendLocation](./gramstax.e2ehelper.sendlocation.md)

## E2eHelper.sendLocation() method

Simulate a user sending a location message.

**Signature:**

```typescript
sendLocation(options?: IE2eLocationOptions): Promise<IE2eApiCall[]>;
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

[IE2eLocationOptions](./gramstax.ie2elocationoptions.md)


</td><td>

_(Optional)_ Latitude, longitude, user, chat, and response options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update.

