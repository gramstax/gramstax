

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [ICompiledTemplate](./gramstax.icompiledtemplate.md)

## ICompiledTemplate type

Compiled template structure containing all parsed template components.

**Signature:**

```typescript
type ICompiledTemplate = {
    media: ReturnType<typeof TemplateEngine.compileBlockGMedia>;
    poll: ReturnType<typeof TemplateEngine.compileBlockGPoll>;
    venue: ReturnType<typeof TemplateEngine.compileBlockGVenue>;
    dice: ReturnType<typeof TemplateEngine.compileBlockGDice>;
    callbackAnswer: ReturnType<typeof TemplateEngine.compileBlockGCallbackAnswer>;
    precheckoutError: ReturnType<typeof TemplateEngine.compileBlockGPrecheckoutError>;
    shippingError: ReturnType<typeof TemplateEngine.compileBlockGShippingError>;
    inlineButton: ReturnType<typeof TemplateEngine.compileBlockGInlineButton>;
    answerNote: ReturnType<typeof TemplateEngine.compileBlockGAnswerNote>;
    gift: ReturnType<typeof TemplateEngine.compileBlockGGift>;
    invoice: ReturnType<typeof TemplateEngine.compileBlockGInvoice>;
    paidMedia: ReturnType<typeof TemplateEngine.compileBlockGPaidMedia>;
    message: ReturnType<typeof TemplateEngine.compileBlockGMessage>;
    keyboard: ReturnType<typeof TemplateEngine.compileBlockGKeyboards>;
    description: ReturnType<typeof TemplateEngine.compileBlockGDescription>;
};
```

## Remarks

This type represents the cached result of template compilation. Each property holds compiled functions for different template sections.

