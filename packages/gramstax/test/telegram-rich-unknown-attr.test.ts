import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "~/template/engine"

describe(`telegram rich unknown attribute validation (Bot API 10.3)`, () => {
  const invalid = (template: string) => {
    const result = TemplateEngine.validateTelegramUnknownAttributesBlock(template)
    expect(result.valid).toBe(false)
    return result.errors
  }
  const valid = (template: string) => {
    const result = TemplateEngine.validateTelegramUnknownAttributesBlock(template)
    expect(result.valid).toBe(true)
  }

  it(`rejects unknown attribute on <table> (reported bug)`, () => {
    const errors = invalid(`<table ngasal="x"><tr><td>a</td></tr></table>`)
    expect(errors[0]!.message).toContain(`<table>`)
    expect(errors[0]!.message).toContain(`ngasal`)
    expect(errors[0]!.message).toContain(`allowed: bordered, striped`)
  })

  it(`rejects unknown attribute on tags with known attributes`, () => {
    invalid(`<a href="https://x.com" target="_blank">x</a>`)
    invalid(`<img src="https://x.com/a.jpg" width="100"/>`)
    invalid(`<tg-map lat="1" long="2" zoom="15" layer="a"/>`)
  })

  it(`rejects ANY attribute on no-attribute tags`, () => {
    const errors = invalid(`<b class="x">bold</b>`)
    expect(errors[0]!.message).toBe(`<b> does not support any attributes`)
    invalid(`<hr foo="1"/>`)
    invalid(`<p data-x="1">text</p>`)
    invalid(`<tg-collage cols="2">a</tg-collage>`)
  })

  it(`rejects {{placeholder}} used as an attribute NAME`, () => {
    const errors = invalid(`<table {{bind}}="x"><tr><td>a</td></tr></table>`)
    expect(errors[0]!.message).toContain(`{{bind}}`)
  })

  it(`accepts {{placeholder}} as an attribute VALUE`, () => {
    valid(`<table striped="{{flag}}"><tr><td>a</td></tr></table>`)
    valid(`<a href="{{link}}">x</a>`)
  })

  it(`accepts all allowed attributes`, () => {
    valid(`<table bordered striped><tr><td colspan="2" align="center" valign="top">a</td></tr></table>`)
    valid(`<blockquote cite="https://x.com" expandable>q</blockquote>`)
    valid(`<li value="1" type="checkbox" checked>item</li>`)
    valid(`<img src="https://x.com/a.jpg" alt="pic" tg-spoiler/>`)
    valid(`<video src="https://x.com/v.mp4" tg-spoiler/>`)
    valid(`<input type="checkbox" checked/>`)
    valid(`<details open><summary>s</summary></details>`)
    valid(`<tg-time unix="1647531900" format="wDT">22:45</tg-time>`)
    valid(`<ol start="3" type="a" reversed><li>x</li></ol>`)
  })

  it(`accepts no-attribute tags with no attributes`, () => {
    valid(`<b>bold</b><br/><p>text</p><h1>t</h1><hr/><footer>f</footer>`)
  })

  it(`reports line numbers correctly`, () => {
    const errors = invalid(`<p>ok</p>\n<table ngasal="1"><tr><td>x</td></tr></table>`)
    expect(errors[0]!.line).toBe(2)
  })

  it(`ignores non-Telegram tags (g-*)`, () => {
    valid(`<g-base id="main"><g-message>hi</g-message></g-base>`)
  })

  it(`ignores unknown non-telegram tags (handled by validateNamesBlock)`, () => {
    valid(`<div class="x">custom</div>`)
  })
})
