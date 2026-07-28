# E2E TEST RULES INDEX

This directory contains E2E test rules for Gramstax projects. AI agents should refer to these Markdown files when creating or modifying E2E tests for template-based Telegram bots.

## Target Folder

- Rule set name: `ctx-e2e`
- Intended source folder: `<PROJECT>/e2e`
- Usage rule: apply these rules when creating or editing E2E test files for the target project's bot pages.

## Rule Pages

- `./E2E_SETUP.md`: `setup.ts` template, project-specific additions, available e2e methods, types, and API mapping.
- `./E2E_TEMPLATES.md`: Test file templates for all scenarios (callback, text command, bottom keyboard, media, flow, error/edge cases, blank test, session isolation).
- `./E2E_VALIDATION.md`: All required validation rules — structure mirroring, message, keyboard, media, multi-call, callback answer, chat action, special media, language variant, and assertion summary.
- `./E2E_CHECKLIST.md`: Comprehensive checklist for new projects.

---

> [!NOTE]
> These rules follow the same structure as `ctx-pages/` for consistency across the Gramstax monorepo.
