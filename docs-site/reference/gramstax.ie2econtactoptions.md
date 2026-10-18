

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IE2eContactOptions](./gramstax.ie2econtactoptions.md)

## IE2eContactOptions type

E2E options for contact messages.

**Signature:**

```typescript
type IE2eContactOptions = IE2eUpdateOptions & {
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    user_id?: number;
};
```
**References:** [IE2eUpdateOptions](./gramstax.ie2eupdateoptions.md)

## Remarks

Extends `IE2eUpdateOptions` with contact card fields. Used by `E2eHelper.sendContact`.

