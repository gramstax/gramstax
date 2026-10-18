---
title: "IRenderWebAppAnswerParams"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderWebAppAnswerParams](./gramstax.irenderwebappanswerparams.md)

## IRenderWebAppAnswerParams type

Parameters for `renderWebAppAnswer`.

**Signature:**

```typescript
type IRenderWebAppAnswerParams = {
    webAppQueryId: string;
    result: InlineQueryResult;
    data?: IData | null;
    AGBaseId?: string | null;
    options?: IOptWebAppAnswer | null;
};
```
**References:** [IData](./gramstax.idata.md), [IOptWebAppAnswer](./gramstax.ioptwebappanswer.md)

## Remarks

Unlike the other answers this carries an explicit query id (there is no context-aware alias — web app queries arrive without an answerable update), mirroring `renderGift`'s explicit target.

