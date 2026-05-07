# VARIABLE NAMING CONVENTIONS

## Page-Level Shorthand

To maintain a high level of code consistency and readability across the Gramstax ecosystem, use the following standardized shorthands for variables within page methods:

| Shorthand | Full Name | Usage                                                        |
| :-------- | :-------- | :----------------------------------------------------------- |
| **bi**    | Base ID   | Holds the identifier string for the current view state.      |
| **kb**    | Keyboard  | Holds the generated keyboard markup (inline or bottom).      |
| **da**    | Data      | Holds the object containing dynamic values for the template. |

## Usage Rules

- **CORRECT**:
  ```typescript
  const bi = Base.step1;
  const da = { amount: 100 };
  const kb = Helper.kb(ctx, bi);
  await ctx.edit(kb, da, bi);
  ```
- **INCORRECT**:
  Do not use expanded names like baseId, keyboardMarkup, or templateData.
- **CONSISTENCY**: These shorthands MUST be used consistently in every page handler.
