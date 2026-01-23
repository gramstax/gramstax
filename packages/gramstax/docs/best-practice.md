# Gramstax Best Practices (Q&A)

Q: What is the main goal of these best practices?
A: To prevent common mistakes when building Gramstax bots by enforcing consistent template usage, correct inline keyboard handling, safe session management, and predictable UX behavior across pages.

Q: How should I structure a Gramstax page?
A: Use a dedicated page class that extends the project PageBase (which extends Ctx). Keep the responsibilities clear: routing handlers (callback/text/textFree) in the page class, shared utilities in core/ or utils/, and storage in store/. Keep templates in the static template of the page class.

Q: How do I correctly handle inline keyboard base IDs?
A: Always separate message bases and keyboard bases. A message base should contain only a <message> block. A keyboard base should contain only a <keyboard> block. When building inline keyboards, pass the keyboard baseId to inlineKeyboard/inlineKeyboardT and pass the message baseId to reply/edit. Never place <keyboard> and <message> in the same base when the keyboard is inline.

Q: What is the correct pattern for inline keyboard + message rendering?
A: Build the keyboard with inlineKeyboard/inlineKeyboardT and a keyboard-only baseId. Then call reply/edit with the message-only baseId.
A: Example pattern:
A: 1) const kb = this.inlineKeyboard(..., {baseId: `navigation`})
A: 2) await this.edit(kb, data, `list`)

Q: How do I build keyboard labels and avoid per-language manual duplication?
A: Use the BlockKeyboard helper (kbk) for keyboard blocks. In templates, use ${this.kbk.home()} or ${this.kbk.cancel()} to render all available languages without manually duplicating labels. Only use manual <keyboard> blocks when the layout is unique (like mixed labels with Prev/Next plus Home).

Q: How do I implement multi-language templates properly?
A: Use the lang attribute in <message> and <keyboard> blocks. Provide a default block (English) and a lang="id" block for Indonesian. The TemplateEngine supports language-specific blocks, so avoid duplicating content without lang attributes. Keep variables and formatting consistent across languages.

Q: How should I structure template content for clarity?
A: Keep messages short, structured, and readable on Telegram. Use spacing between sections, and keep lists on separate lines. Avoid long paragraphs. Use emoji sparingly but consistently to create visual anchors for actions and status.

Q: How should I use sessionTextFree for multi-step input?
A: Use sessionTextFree(params) to start or continue a multi-step free-form flow. Store the step in params (e.g., {step: `title`}) and read it from this.session.params. Always call validateSessionTextFree() before processing textFree input. Use sessionClear() after the flow completes successfully.

Q: When should I call sessionClear()?
A: Clear sessions after completing a multi-step flow or when entering a new top-level menu. For example, after successful create/update/delete, and when opening the main menu (/start). Do not clear sessions on intermediate steps that still require user input. Avoid clearing sessions on non-terminal error prompts unless you want to reset the flow.

Q: Should I call sessionGet() before using this.session?
A: Yes, call sessionGet() in textFree handlers before reading this.session.params. This ensures the latest session payload is loaded. Only skip it if your page does not rely on session params.

Q: How should I design pagination for list pages?
A: Use inline keyboards with Prev/Next buttons and keep page size consistent (e.g., 5 items). Store page data in callback payloads using buildData. Use a keyboard-only base for navigation (e.g., baseId `navigation`) and a message-only base for the list content. Show a friendly empty state with a keyboard that leads back home.

Q: How do I handle empty states for list and selection pages?
A: Always show an inline keyboard even when there is no data. Provide a clear message and a Home/Back button to avoid dead ends. Use a dedicated empty message base and a dedicated keyboard base (e.g., empty + empty-kb).

Q: How should I structure callbackPayload handlers?
A: Parse action tokens from callbackDataPayloads and handle each action explicitly. Provide a safe fallback that returns to a stable view (e.g., showSelect(0) or showList(0)). Never assume payloads are valid; validate them and handle invalid values gracefully.

Q: How do I handle error/fallback pages?
A: Provide a unified error page that clears session if the flow cannot continue. Use a dedicated keyboard base with a Home button. Keep error messages short and instructive; avoid leaking internal error details to users.

Q: How do I keep UX consistent across pages?
A: Use consistent button labels, consistent emoji usage, and consistent layout spacing. If you use Home/Back/Cancel, define them in KeyboardBlock labels and reuse via kbk in templates. Keep action labels aligned with the Start page menu.

Q: What is the right way to handle Update flows with inline keyboards?
A: For status updates, present a paginated selection list with inline buttons. After selecting an item, show a status selection keyboard on a dedicated keyboard base. Use a success message with its own keyboard base and return the user to a safe entry point.

Q: How do I implement hybrid input (inline + text input) correctly?
A: Show an inline list for quick selection while also allowing text input for IDs. Use sessionTextFree when expecting manual input and validate it. Always provide a keyboard base for navigation even in hybrid flows.

Q: Should I edit or reply when transitioning between screens?
A: Prefer edit when responding to inline callbacks to keep the chat clean. Use reply for text input flow responses or when there is no message to edit. Always keep the keyboard and message base IDs aligned with the method used.

Q: How should I set up routing names for callback payloads?
A: Use buildData to generate consistent callback payload tokens. Keep action tokens short and explicit (e.g., `page`, `select`, `status`). Always parse and validate payloads in callbackPayload handlers.

Q: How do I keep code readable and maintainable?
A: Keep page logic focused on one responsibility. Extract store logic into store classes. Use type aliases for structured data (e.g., CrudItem) and keep function signatures explicit. Avoid large monolithic handlers; use helper methods (showSelect, showStatus, handleDelete).

Q: How do I avoid common template mistakes?
A: Do not mix <message> and <keyboard> in the same base when using inline keyboards. Ensure base IDs are unique and meaningful. Use correct baseId when calling inlineKeyboard/inlineKeyboardT. Keep language-specific blocks aligned across languages.

Q: How do I ensure consistent language coverage?
A: For every user-facing message, provide a default (English) and an Indonesian (lang="id") block. For keyboard blocks, use kbk helpers to render all languages consistently or provide both <keyboard> blocks with lang attributes if the layout is unique.

Q: How do I format text for Telegram?
A: Keep lines short, avoid excessive blank lines, and use simple markup when needed. Avoid overly long lists. Use descriptive labels for actions and status.

Q: What is a safe pattern for success states?
A: Show a success message, provide a keyboard with a single safe navigation action (Home or Back), and clear the session if the flow is complete. Avoid leaving the user without a next action.

Q: How should I name base IDs?
A: Use descriptive and consistent names: `list`, `navigation`, `empty`, `success`, `form-title`, and pair keyboards with suffix `-kb` (e.g., `list-kb`, `empty-kb`). This makes the intent clear and avoids collisions.
