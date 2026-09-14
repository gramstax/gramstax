/**
 * Case 8: HTML Escaping (`{{}}` vs `{{{}}}`)
 *
 * This POC proves the output-encoding contract: `{{var}}` HTML-escapes
 * `&`, `<`, `>` at runtime, so markup smuggled in DATA cannot become live
 * HTML in Telegram clients. `{{{var}}}` is raw by design (documented) and
 * must only receive trusted content.
 *
 * Expected: escaped output contains `&lt;script&gt;` and no live tags;
 * raw output contains the markup literally.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 8: HTML ESCAPING ---`)

const xss = `<script>alert("xss")</script><img src="x" onerror="alert(2)">A & B <b>bold</b>`

const template = `<g-base><g-message>Escaped: {{bio}} | Raw: {{{bio}}}</g-message></g-base>`
const render = TemplateEngine.compileBlockGMessage(template).default?.default
if (!render) throw new Error(`compile produced no default message`)
const out = render({bio: xss}) as string
console.log(`Output:`, JSON.stringify(out))

const escapedOk = out.includes(`Escaped: &lt;script&gt;`) && out.includes(`A &amp; B`)
const rawOk = out.includes(`Raw: <script>alert("xss")</script>`)

if (escapedOk && rawOk) {
  console.log(`SAFE: {{}} escaped markup, {{{}}} raw by design`)
} else {
  console.log(`VULNERABLE: escaping contract broken`)
  process.exit(1)
}
