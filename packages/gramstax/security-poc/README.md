# Proof of Concept (POC)

files documenting various security scenarios in TemplateEngine (gramstax). Each file describes the vulnerability, risks, and expected results.
Here is a list of the files created:
You can run these files using the command `bun run packages/gramstax/security-poc/<filename>.ts` to see the results immediately.

## 1-template-breakout.ts:

Demonstrates how the backtick (`) character within a template can hijack JavaScript string literals to execute code (RCE).

## 2-interpolation-injection.ts:

Demonstrates that the ${} syntax within a template is automatically evaluated by JavaScript, which can be exploited if the template content comes from an untrusted source.

## 3-safe-data-binding.ts:

Demonstrates that using the standard {{key}} syntax is highly secure against user input. Data passed via data objects will never be executed as code.

## 4-untrusted-template-rce.ts:

Demonstrates the most dangerous scenario where user input is directly embedded into the template string (rather than as a data variable), allowing users to inject <g-script> tags for full control over the server.

## 5-filter-argument-injection.ts:

Proves that hostile filter names and arguments in `{{var|filter}}` pipes cannot break out of the generated code (arguments are embedded via `JSON.stringify`, unknown names render empty).

## 6-switch-each-breakout.ts:

Proves that backticks and `${}` smuggled into `<g-case>`, `<g-default>`, and `<g-map>` static bodies render literally and never execute.

## 7-media-group-src-breakout.ts:

Proves that backticks, quotes, and `${}` smuggled into media `src` values (pipe-delimited and `<g-media-group>` items) stay inert strings in the compiled definitions.

## 8-xss-escaping.ts:

Proves the output-encoding contract: `{{var}}` HTML-escapes `&`, `<`, `>` so markup in data cannot become live HTML, while `{{{var}}}` is raw by design.

## 9-attribute-injection.ts:

Proves that hostile attribute values (backticks, quotes, `${}`, in double-quoted, single-quoted, and bare syntax) stay inert strings across `value`, `is`, `join`, `type`, and `src`.

## 10-unknown-block-passthrough.ts:

Proves that unrecognized tags are flagged by `validateNamesBlock` and rendered literally by the compiler — no tag smuggles code except the documented code blocks (`<g-script>`, `{~ ~}`).

# Key Security Recommendation:

Always treat template strings as code (to be written only by developers), while Data (the object passed to the render function) is a safe place to hold user input.
