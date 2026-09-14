import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "~/template/engine"

const renderMsg = (inner: string, data: Record<string, unknown> = {}): string => {
  const tpl = `<g-base><g-message>${inner}</g-message></g-base>`
  const fn = TemplateEngine.compileBlockGMessage(tpl).default?.default
  if (!fn) throw new Error(`compile produced no default message`)
  return fn(data)
}

describe(`template engine security RED (findings 01-15)`, () => {
  it(`01 static backtick does not break out of the template literal`, () => {
    const out = renderMsg(`Safe \` + (7*6) + \` text`)
    expect(out).not.toContain(`42`)
    expect(out).toContain(`\``)
  })

  it(`02 static \${} interpolation is rendered literally`, () => {
    const out = renderMsg(`Time: \${7*6}`)
    expect(out).toBe(`Time: \${7*6}`)
  })

  it(`02b nested \${} in switch-case and map bodies renders literally`, () => {
    const switched = renderMsg(`<g-switch value="s"><g-case is="a">\${7*6}</g-case><g-default>d</g-default></g-switch>`, {s: `a`})
    expect(switched).toBe(`\${7*6}`)
    const mapped = renderMsg(`<g-map src="items">\${7*6}</g-map>`, {items: [`x`]})
    expect(mapped).toBe(`\${7*6}`)
  })

  it(`03 filter arg containing a backtick renders literally`, () => {
    const processed = TemplateEngine._processScopeVariables(`{{v|default:a\`b}}`)
    const out = TemplateEngine._compileToFunction(processed, false)({})
    expect(out).toBe(`a\`b`)
  })

  it(`04 g-switch case content with backticks renders literally`, () => {
    const out = renderMsg(`<g-switch value="s"><g-case is="a">A\` + (7*6) + \`B</g-case></g-switch>`, {s: `a`})
    expect(out).not.toContain(`42`)
    expect(out).toContain(`\``)
  })

  it(`04b g-switch valueKey with backslash does not throw`, () => {
    const out = renderMsg(`<g-switch value="a\\"><g-case is="a\\">hit</g-case><g-default>miss</g-default></g-switch>`)
    expect(typeof out).toBe(`string`)
    expect(out).not.toContain(`42`)
  })

  it(`05 g-map join containing a backtick renders literally`, () => {
    const out = renderMsg(`<g-map src="items" join="\`">{{e}}</g-map>`, {items: [`x`, `y`]})
    expect(out).toBe(`x\`y`)
  })

  it(`05b g-map content with backticks renders literally`, () => {
    const out = renderMsg(`<g-map src="items" join=", ">A\` + (7*6) + \`B</g-map>`, {items: [`x`]})
    expect(out).not.toContain(`42`)
    expect(out).toContain(`\``)
  })

  it(`06 by-design: g-script and {~ ~} execute developer code (template is code)`, () => {
    expect(renderMsg(`<g-script>return \`hi\`</g-script>`)).toBe(`hi`)
    expect(renderMsg(`{~ 1 + 1 ~}`)).toBe(`2`)
    expect(renderMsg(`{~ name ~}`, {name: `Budi`})).toBe(`Budi`)
  })

  it(`07 _validatePageTagAttributes reads _PAGE_REQUIRED_ATTRS`, () => {
    const prev = TemplateEngine._PAGE_REQUIRED_ATTRS
    const spec: Record<string, string[] | {oneOf: string[][]}> = {}
    spec[`g-map`] = [`src`]
    TemplateEngine._PAGE_REQUIRED_ATTRS = spec
    try {
      const errors = TemplateEngine._validatePageTagAttributes(`<g-map join="x"></g-map>`)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]?.message).toContain(`src`)
    } finally {
      TemplateEngine._PAGE_REQUIRED_ATTRS = prev
    }
  })

  it(`08 spaces inside {{}} and {{{}}} are trimmed`, () => {
    expect(renderMsg(`{{ name }}`, {name: `Budi`})).toBe(`Budi`)
    expect(renderMsg(`{{{ name }}}`, {name: `<b>x</b>`})).toBe(`<b>x</b>`)
  })

  it(`09 escape scope is text-node interpolation: {{}} escapes, {{{}}} stays raw`, () => {
    expect(renderMsg(`{{x}}`, {x: `<b>a & b</b>`})).toBe(`&lt;b&gt;a &amp; b&lt;/b&gt;`)
    expect(renderMsg(`{{{x}}}`, {x: `<b>a & b</b>`})).toBe(`<b>a & b</b>`)
  })

  it(`10 unknown filter warns per compile and valid siblings still render`, () => {
    const tag = `nope${Date.now()}`
    const warns: string[] = []
    const orig = console.warn
    console.warn = (...args: unknown[]) => {
      warns.push(String(args[0]))
    }
    try {
      TemplateEngine._processScopeVariables(`{{a|${tag}}}`)
      TemplateEngine._processScopeVariables(`{{a|${tag}}}`)
    } finally {
      console.warn = orig
    }
    expect(warns.length).toBe(2)
    const processed = TemplateEngine._processScopeVariables(`{{a|upper}} {{b|${tag}}} {{c|lower}}`)
    const out = TemplateEngine._compileToFunction(processed, false)({a: `x`, b: `y`, c: `Y`})
    expect(out).toBe(`X  y`)
  })

  it(`11 date filter keeps HH:mm:ss whole`, () => {
    const processed = TemplateEngine._processScopeVariables(`{{t|date:HH:mm:ss}}`)
    const out = TemplateEngine._compileToFunction(processed, false)({t: `2026-08-15T13:14:15Z`})
    expect(out).toBe(`13:14:15`)
  })

  it(`11b plural filter still splits two args`, () => {
    const processed = TemplateEngine._processScopeVariables(`{{n|plural:item:items}}`)
    const fn = TemplateEngine._compileToFunction(processed, false)
    expect(fn({n: 1})).toBe(`item`)
    expect(fn({n: 3})).toBe(`items`)
  })

  it(`12 number filter renders empty for non-numeric input`, () => {
    const processed = TemplateEngine._processScopeVariables(`{{v|number:2}}`)
    const out = TemplateEngine._compileToFunction(processed, false)({v: `abc`})
    expect(out).toBe(``)
  })

  it(`12b default filter does not catch 0 or false (documented)`, () => {
    const processed = TemplateEngine._processScopeVariables(`{{v|default:N/A}}`)
    const fn = TemplateEngine._compileToFunction(processed, false)
    expect(fn({v: 0})).toBe(`0`)
    expect(fn({v: false})).toBe(`false`)
    expect(fn({})).toBe(`N/A`)
  })

  it(`13 validation skips values containing placeholders`, () => {
    expect(TemplateEngine._validateTelegramTagAttributeValues(`<tg-time unix="123{{x}}">a</tg-time>`)).toEqual([])
    expect(TemplateEngine._validatePageTagAttributeValues(`<g-media type="ph{{x}}o" src="a">x</g-media>`)).toEqual([])
  })

  it(`14 single-quoted g-switch and g-map attributes parse like double-quoted`, () => {
    const sw = renderMsg(`<g-switch value='status'><g-case is='a'>A</g-case><g-default>D</g-default></g-switch>`, {status: `a`})
    expect(sw).toBe(`A`)
    const mp = renderMsg(`<g-map src='items' join=', '>{{e}}</g-map>`, {items: [`x`, `y`]})
    expect(mp).toBe(`x, y`)
  })

  it(`14b bare (unquoted) g-map src parses`, () => {
    const mp = renderMsg(`<g-map src=items>{{e}}</g-map>`, {items: [`x`, `y`]})
    expect(mp).toBe(`x\ny`)
  })

  it(`15 telegram allowed-attr registry counts (54 tags, 53 unique keys)`, () => {
    expect([...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_LEGACY, ...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH].length).toBe(54)
    expect(Object.keys(TemplateEngine._TELEGRAM_ALLOWED_ATTRS).length).toBe(53)
  })

  it(`oracle PoC-3: {{}} data payload is never executed`, () => {
    const payload = "X`Y\${7*6}Z"
    const out = renderMsg(`Hello {{username}}!`, {username: payload})
    expect(out).toContain(payload)
    expect(out).not.toContain(`42`)
  })
})
