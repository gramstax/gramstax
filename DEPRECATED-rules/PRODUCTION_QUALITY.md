# PRODUCTION QUALITY RULES

## Philosophy: "Ship Finished Code"

All code must be of professional, production-ready quality. There is no place for "WIP" code in the main branches.

## Technical Excellence

- **STABILITY**: Logic must handle common edge cases (e.g., empty inputs, network timeouts).
- **DATABASE INTEGRITY**:
  - Use optimized and safe SQL queries for PostgreSQL.
  - Leverage efficient key-value access for LMDB.
- **ERROR HANDLING**: Never swallow errors. Always provide meaningful, user-friendly feedback via Main methods.

## User Experience (UX)

- **CLEAR CONTENT**: Message strings must be clear, helpful, and contextual. Avoid developer jargon.
- **INTENTIONAL EMOJIS**: Use emojis that align with the message context. Use them sparingly to highlight important elements.
- **FAST FEEDBACK**: Ensure UI transitions feel snappy and responsive.
