# PAGE CLASS STRUCTURE RULES

## Composition Rules

Each page file must follow a strict modular structure. **Only define internal classes if they contain logic or data.** Empty class blocks are prohibited.

| Class        | Purpose             | Mandatory Naming                      |
| :----------- | :------------------ | :------------------------------------ |
| **Base**     | g-base id constants | static <idName> = `id`                |
| **Constant** | Reusable literals   | static <CONST_NAME> = value           |
| **Helper**   | Local utilities     | static kb(ctx, bi) { ... }            |
| **Main**     | Business Logic      | show{NameBase}, [process{NameBase}]   |

## Execution Path (Main Class)

- **Form Display**: Method name MUST be `show{NameBase}` where `{NameBase}` is a descriptive camelCase name for the step or state (e.g., `showAmount`, `showConfirm`).
- **Processing (OPTIONAL)**: Method name is `process{NameBase}` and MUST reuse the SAME `{NameBase}` as its paired `show{NameBase}`.
- **OPTIONAL PAIRING**: `process{NameBase}` is OPTIONAL. Define it ONLY when `show{NameBase}` expects a text/answer input that must be processed (e.g., a form the user fills in). If `show{NameBase}` has no answer process, OMIT `process{NameBase}` entirely — do NOT define a `throw ctx` no-op placeholder.
- **REQUIREMENT**: The Main class is mandatory for all pages except system pages like general-status.ts.

## File Ordering (STRICT)

Classes within the file **MUST** be declared in this exact order:

1. **Base**
2. **Constant**
3. **Helper**
4. **Main**
5. **Page** (The exported class, inheriting from PageBase)

## Feedback in Main

Feedback methods live as **static methods inside `Main`**, **after** all `show{NameBase}` (and `process{NameBase}`, if defined) methods.

Naming prefixes:

| Prefix        | Use Case                |
| ------------- | ----------------------- |
| `showSuccess` | Positive outcomes       |
| `showFailed`  | Business logic failures |
| `showError`   | System errors           |
| `showWarn`    | Validation warnings     |
| `showInfo`    | Informative content     |
