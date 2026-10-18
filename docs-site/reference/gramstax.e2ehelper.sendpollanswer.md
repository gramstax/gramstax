

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendPollAnswer](./gramstax.e2ehelper.sendpollanswer.md)

## E2eHelper.sendPollAnswer() method

Simulate a poll update sent by the bot (used for poll answer testing).

**Signature:**

```typescript
sendPollAnswer(pollId: string, optionIds: number[], options?: IE2eUpdateOptions): Promise<IE2eApiCall[]>;
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

pollId


</td><td>

string


</td><td>

The poll identifier.


</td></tr>
<tr><td>

optionIds


</td><td>

number\[\]


</td><td>

Array of selected option IDs.


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

