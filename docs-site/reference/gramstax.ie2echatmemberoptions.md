

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IE2eChatMemberOptions](./gramstax.ie2echatmemberoptions.md)

## IE2eChatMemberOptions type

Options for simulating a chat member status transition update.

**Signature:**

```typescript
type IE2eChatMemberOptions = IE2eUpdateOptions & {
    oldStatus?: string;
    newStatus?: string;
    oldIsMember?: boolean;
    newIsMember?: boolean;
    botId?: number;
};
```
**References:** [IE2eUpdateOptions](./gramstax.ie2eupdateoptions.md)

## Remarks

Used with `E2eHelper.sendChatMemberUpdate` and `E2eHelper.sendMyChatMemberUpdate` to simulate membership changes.

