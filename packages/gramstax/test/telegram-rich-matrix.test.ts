import {describe, expect, it } from "bun:test"
import {TemplateEngine} from "~/template/engine"

/**
 * Exhaustive matrix: every official attribute of every rich tag exercised with
 * valid and invalid values (Bot API 10.2). Add rows when the spec changes —
 * the test loop runs the whole table. Void tags are rendered self-closing;
 * content tags get a closing tag. {{placeholder}} values are excluded here
 * (they are covered by a dedicated test in template.engine.test.ts).
 */
const matrix: Array<{tag: string; attr: string; valid: string[]; invalid: string[]}> = [
  // inline / media / forms
  {tag: `a`, attr: `href`, valid: [`https://x.com`, `http://x.com`, `mailto:a@b.c`, `tel:+123`, `tg://user?id=1`, `#anchor`], invalid: [`javascript:alert(1)`, `data:text/html`, `ftp://x`, `relative`]},
  {tag: `a`, attr: `name`, valid: [`ref1`], invalid: [``]},
  {tag: `img`, attr: `src`, valid: [`https://x.com/a.jpg`, `http://x.com/a`], invalid: [`ftp://x/a`, `//x/a`, `x.jpg`, `data:image/png;base64,abc`]},
  {tag: `video`, attr: `src`, valid: [`https://x.com/a.mp4`], invalid: [`file:///a.mp4`, `a.mp4`]},
  {tag: `audio`, attr: `src`, valid: [`https://x.com/a.mp3`], invalid: [`a.mp3`, `ftp://x/a.mp3`]},
  {tag: `tg-emoji`, attr: `emoji-id`, valid: [`5368324170671202286`], invalid: [`abc`, `-1`, `1.5`]},
  {tag: `tg-time`, attr: `unix`, valid: [`1720000000`], invalid: [`0`, `-1`, `abc`, `1.5`]},
  {tag: `tg-time`, attr: `format`, valid: [`t`, `r`, `w`, `d`, `D`, `wD`, `wdt`, `wDT`], invalid: [`X`, `xx`, ``]},
  {tag: `tg-map`, attr: `lat`, valid: [`0`, `-90`, `90`, `41.9`], invalid: [`91`, `-91`, `abc`]},
  {tag: `tg-map`, attr: `long`, valid: [`0`, `-180`, `180`, `12.5`], invalid: [`181`, `-181`, `abc`]},
  {tag: `tg-map`, attr: `zoom`, valid: [`13`, `14`, `19`], invalid: [`12`, `20`, `0`, `24`, `abc`, `1.5`]},
  {tag: `tg-reference`, attr: `name`, valid: [`note-1`], invalid: [``]},
  {tag: `input`, attr: `type`, valid: [`checkbox`], invalid: [`text`, `number`, `email`, `submit`, `foobar`]},
  // block / structural
  {tag: `ol`, attr: `start`, valid: [`0`, `5`, `100`], invalid: [`-1`, `abc`, `1.5`]},
  {tag: `ol`, attr: `type`, valid: [`1`, `a`, `A`, `i`, `I`], invalid: [`x`, `Z`, `1.5`]},
  {tag: `ol`, attr: `reversed`, valid: [`true`], invalid: []},
  {tag: `li`, attr: `value`, valid: [`3`, `0`], invalid: [`x`, `-1`, `1.5`]},
  {tag: `li`, attr: `type`, valid: [`1`, `a`, `checkbox`], invalid: [`z`, `radio`]},
  {tag: `li`, attr: `checkbox`, valid: [`true`], invalid: []},
  {tag: `li`, attr: `checked`, valid: [`true`], invalid: []},
  {tag: `table`, attr: `bordered`, valid: [`true`], invalid: []},
  {tag: `table`, attr: `striped`, valid: [`true`], invalid: []},
  {tag: `td`, attr: `colspan`, valid: [`1`, `3`], invalid: [`0`, `-1`, `x`]},
  {tag: `td`, attr: `rowspan`, valid: [`2`], invalid: [`0`, `x`]},
  {tag: `td`, attr: `align`, valid: [`left`, `center`, `right`], invalid: [`middle`, `justify`]},
  {tag: `td`, attr: `valign`, valid: [`top`, `middle`, `bottom`], invalid: [`center`, `baseline`]},
  {tag: `th`, attr: `colspan`, valid: [`2`], invalid: [`0`, `x`]},
  {tag: `th`, attr: `rowspan`, valid: [`2`], invalid: [`0`, `x`]},
  {tag: `blockquote`, attr: `cite`, valid: [`https://x.com`, `http://x.com`], invalid: [`x.com`, ``]},
  {tag: `blockquote`, attr: `expandable`, valid: [`true`], invalid: []},
  {tag: `aside`, attr: `cite`, valid: [`https://x.com`], invalid: [`x.com`, ``]},
  {tag: `details`, attr: `open`, valid: [`true`], invalid: []},
  {tag: `code`, attr: `class`, valid: [`language-ts`, `language-js`], invalid: [`foo`, `language-`, `ts`]}
]

const VOID_TAGS = new Set([`img`, `input`, `br`, `hr`, `tg-map`])

// Valid defaults for required attributes of each tag, so a single-attribute
// matrix row never trips the required-attr validator.
const REQUIRED_DEFAULTS: Record<string, Record<string, string>> = {
  img: {src: `https://example.com/a.jpg`},
  video: {src: `https://example.com/a.mp4`},
  audio: {src: `https://example.com/a.mp3`},
  "tg-emoji": {"emoji-id": `5368324170671202286`},
  "tg-time": {unix: `1720000000`},
  "tg-map": {lat: `0`, long: `0`, zoom: `14`},
  "tg-reference": {name: `note-1`},
  input: {type: `checkbox`}
}

function render(tag: string, attr: string, value: string): string {
  const attrs = {...REQUIRED_DEFAULTS[tag], [attr]: value}
  const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(` `)
  const body = VOID_TAGS.has(tag) ? `<${tag} ${attrStr}/>` : `<${tag} ${attrStr}>x</${tag}>`
  return `<g-base><g-message>${body}</g-message></g-base>`
}

describe(`telegram rich attribute matrix (Bot API 10.2)`, () => {
  for (const row of matrix) {
    it(`accepts valid ${row.tag} ${row.attr}=${row.valid.join(`|`)}`, () => {
      for (const v of row.valid) {
        const result = TemplateEngine.validateTemplate(render(row.tag, row.attr, v))
        expect(result.valid, `valid value ${v} for ${row.tag}[${row.attr}] should pass (errors: ${result.errors.map((e) => e.message).join(`; `)})`).toBe(true)
      }
    })
    it(`rejects invalid ${row.tag} ${row.attr}=${row.invalid.join(`|`)}`, () => {
      for (const v of row.invalid) {
        const result = TemplateEngine.validateTemplate(render(row.tag, row.attr, v))
        expect(result.valid, `invalid value ${v} for ${row.tag}[${row.attr}] should fail`).toBe(false)
      }
    })
  }

  it(`covers every attribute in the value validator spec`, () => {
    // Guard: every (tag, attr) key in _TELEGRAM_ATTR_VALUE_VALIDATORS has a matrix row.
    const covered = new Set(matrix.map((r) => `${r.tag}:${r.attr}`))
    for (const [tag, attrs] of Object.entries(TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS)) {
      for (const attr of Object.keys(attrs)) {
        expect(covered.has(`${tag}:${attr}`), `matrix missing row for ${tag}[${attr}]`).toBe(true)
      }
    }
  })
})