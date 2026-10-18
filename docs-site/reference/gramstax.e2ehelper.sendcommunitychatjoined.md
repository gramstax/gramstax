

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendCommunityChatJoined](./gramstax.e2ehelper.sendcommunitychatjoined.md)

## E2eHelper.sendCommunityChatJoined() method

Simulate a community chat joined service message (Bot API 10.3 `community_chat_joined`).

**Signature:**

```typescript
sendCommunityChatJoined(options?: IE2eUpdateOptions & {
        community?: {
            id?: number;
            name?: string;
        };
    }): Promise<IE2eApiCall[]>;
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

[IE2eUpdateOptions](./gramstax.ie2eupdateoptions.md) &amp; &#123; community?: &#123; id?: number; name?: string; &#125;; &#125;


</td><td>

_(Optional)_ User, chat and response options


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update

