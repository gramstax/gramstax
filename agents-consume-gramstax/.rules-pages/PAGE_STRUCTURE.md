# PAGE CLASS STRUCTURE RULES

## Composition Rules

Each page file must follow a strict modular structure. **Only define internal classes if they contain logic or data.** Empty class blocks are prohibited.

| Class        | Purpose           | Mandatory Naming                           |
| :----------- | :---------------- | :----------------------------------------- |
| **Base**     | Base ID constants | static <idName> = `id`                     |
| **Constant** | Reusable literals | static <CONST_NAME> = value                |
| **Helper**   | Local utilities   | static kb(ctx, bi) { ... }                 |
| **Alert**    | Feedback messages | static async showSuccess(ctx, ...) { ... } |
| **Main**     | Business Logic    | showStep{N}Form, processStep{N}Answer      |

## Execution Path (Main Class)

- **Form Display**: Suffix MUST be `Form` (e.g., showStep1Form).
- **Processing**: Suffix MUST be `Answer` (e.g., processStep1Answer).
- **MANDATORY PAIRING**: If a `showStep{N}Form` is defined, the corresponding `processStep{N}Answer` MUST also be defined.
- **NO-OP PROCESSING**: If the answer method is not required but must be defined for pairing, the implementation MUST be exactly: `throw ctx`.
- **REQUIREMENT**: The Main class is mandatory for all pages except system pages like general-status.ts.

## File Ordering (STRICT)

Classes within the file **MUST** be declared in this exact order:

1. **Base**
2. **Constant**
3. **Helper**
4. **Alert**
5. **Main**
6. **Page** (The exported class, inheriting from PageBase)

## Alert Patterns

Use these prefixes for methods in the Alert class:

- showSuccess: For positive outcomes.
- showFailed: For business logic failures.
- showError: For system errors.
- showWarn: For validation warnings.
- showInfo: For informative/help content.
