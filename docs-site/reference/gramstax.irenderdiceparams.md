

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderDiceParams](./gramstax.irenderdiceparams.md)

## IRenderDiceParams type

Parameters for `renderDice`.

**Signature:**

```typescript
type IRenderDiceParams = IContent & Omit<IRouteForcedReply, `options`> & {
    options?: IOptDice | null;
};
```
**References:** [IContent](./gramstax.icontent.md), [IRouteForcedReply](./gramstax.irouteforcedreply.md), [IOptDice](./gramstax.ioptdice.md)

## Remarks

`params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`, read from the `<g-dice>` block) on the forced-send route (`IRouteReply`), with the option slot narrowed to the `sendDice` call (`IOptDice`).

The emoji comes from the COMPILED block (`🎲` default when the attribute is absent) and is checked by `Ctx.assertDiceEmoji` BEFORE any API call.

