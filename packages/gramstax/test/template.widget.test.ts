import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-widget`)

const regularTemplate = `<g-base>
  <g-widget allow_queries chat_data='{"order": "1042"}' width="400" height="300">
    <div class="card"><button onclick="send('tap')">Tap me</button><script>const cfg = {'key': 'val'}; const t = \`hi \${name}\`;</script></div>
    <g-widget-caption>Order <b>#1042</b> — tap to rate it</g-widget-caption>
  </g-widget>
</g-base>`

const sharedTemplate = `<g-base>
  <g-widget is_shared public_data='{"poll": "stars"}' show_caption_above_media>
    <div>Shared widget</div>
    <g-widget-caption>Rate us, everyone sees the same stars</g-widget-caption>
  </g-widget>
</g-base>`

const dynamicTemplate = `<g-base>
  <g-widget chat_data='{"order": "{{orderId}}"}' width="{{w}}" height="{{h}}">
    <div>Order widget</div>
    <g-widget-caption>Order <b>#{{orderId}}</b></g-widget-caption>
  </g-widget>
</g-base>`

const wrap = (inner: string): string => `<g-base>
  <g-widget${inner}>
</g-base>`

describe(`widget-parser`, () => {
  it(`parses a regular widget with defaults`, () => {
    const widgets = TemplateEngine._processGWidgetBlocks(regularTemplate)
    expect(widgets.default?.caption).toBe(`Order <b>#1042</b> — tap to rate it`)
    expect(widgets.default?.allow_queries).toBe(true)
    expect(widgets.default?.chat_data).toBe(`{"order": "1042"}`)
    expect(widgets.default?.width).toBe(400)
    expect(widgets.default?.height).toBe(300)
    expect(widgets.default?.is_shared).toBeUndefined()
  })

  it(`keeps the HTML raw: divs, script, JS object literals and template literals untouched`, () => {
    const widgets = TemplateEngine._processGWidgetBlocks(regularTemplate)
    const html = widgets.default?.html ?? ``
    expect(html).toContain(`<div class="card">`)
    expect(html).toContain(`<button onclick="send('tap')">Tap me</button>`)
    expect(html).toContain(`const cfg = {'key': 'val'};`)
    expect(html).toContain(`const t = \`hi \${name}\`;`)
    expect(html).not.toContain(`<g-widget-caption>`)
  })

  it(`parses a shared widget with public_data and bare boolean flags`, () => {
    const widgets = TemplateEngine._processGWidgetBlocks(sharedTemplate)
    expect(widgets.default?.is_shared).toBe(true)
    expect(widgets.default?.public_data).toBe(`{"poll": "stars"}`)
    expect(widgets.default?.show_caption_above_media).toBe(true)
    expect(widgets.default?.chat_data).toBeUndefined()
  })

  it(`parses valued booleans as false and dynamic width/height as raw strings`, () => {
    const widgets = TemplateEngine._processGWidgetBlocks(
      wrap(` allow_queries="false" is_shared="false">
    <div>x</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(widgets.default?.allow_queries).toBe(false)
    expect(widgets.default?.is_shared).toBe(false)
    const dynamic = TemplateEngine._processGWidgetBlocks(dynamicTemplate)
    expect(dynamic.default?.width).toBe(`{{w}}`)
    expect(dynamic.default?.height).toBe(`{{h}}`)
  })

  it(`keys widgets by lang with last block winning`, () => {
    const widgets = TemplateEngine._processGWidgetBlocks(`<g-base><g-widget lang="id"><div>x</div><g-widget-caption>Cap</g-widget-caption></g-widget></g-base>`)
    expect(Object.keys(widgets)).toEqual([`id`])
  })
})

describe(`widget-validator`, () => {
  it(`accepts a valid regular widget`, () => {
    expect(TemplateEngine.validateTemplate(regularTemplate).valid).toBe(true)
  })

  it(`accepts a valid shared widget`, () => {
    expect(TemplateEngine.validateTemplate(sharedTemplate).valid).toBe(true)
  })

  it(`accepts a widget whose HTML holds divs, script and JS object literals the validators would otherwise reject`, () => {
    expect(TemplateEngine.validateTemplate(regularTemplate).valid).toBe(true)
  })

  it(`accepts dynamic caption and chat_data (static checks skipped)`, () => {
    expect(TemplateEngine.validateTemplate(dynamicTemplate).valid).toBe(true)
  })

  it(`rejects a missing caption`, () => {
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(`>
    <div>x</div>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`exactly one <g-widget-caption>`))).toBe(true)
  })

  it(`rejects two captions`, () => {
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(`>
    <div>x</div>
    <g-widget-caption>One</g-widget-caption>
    <g-widget-caption>Two</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`exactly one <g-widget-caption> (got 2)`))).toBe(true)
  })

  it(`rejects an unknown attribute`, () => {
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(` foo="1">
    <div>x</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`rejects a caption attribute (caption is the child block only)`, () => {
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(` caption="hi">
    <div>x</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`rejects a bad boolean value`, () => {
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(` allow_queries="yes">
    <div>x</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`allow_queries`))).toBe(true)
  })

  it(`rejects width outside 200-600`, () => {
    for (const width of [`100`, `700`, `abc`]) {
      const result = TemplateEngine.validateBlockGWidgetAttributes(
        wrap(` width="${width}">
    <div>x</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`width`))).toBe(true)
    }
  })

  it(`rejects height outside 50-600`, () => {
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(` height="20">
    <div>x</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`height`))).toBe(true)
  })

  it(`rejects a static caption over 1024 characters`, () => {
    const long = `C`.repeat(1025)
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(`>
    <div>x</div>
    <g-widget-caption>${long}</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-1024`))).toBe(true)
  })

  it(`rejects HTML over 32768 bytes raw`, () => {
    const big = `x`.repeat(32769)
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(`>
    <div>${big}</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`32768 bytes raw`))).toBe(true)
  })

  it(`rejects HTML that compresses above the 4000-byte safe target`, () => {
    // 8000 chars from a deterministic xorshift PRNG over [a-zA-Z0-9]:
    // incompressible enough that zlib level 9 stays well above 4000 bytes,
    // while raw stays under 32768. (A linear `i * k % n` sequence would be
    // periodic and compress to almost nothing — do not "simplify" this.)
    let seed = 0x12345678
    const next = (): number => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) % 62
    }
    const alphabet = `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`
    const noisy = Array.from({length: 8000}, () => alphabet[next()]!).join(``)
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(`>
    <div>${noisy}</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`above the safe target of 4000`))).toBe(true)
  })

  it(`rejects static chat_data over 1024 bytes`, () => {
    const big = `x`.repeat(1025)
    const result = TemplateEngine.validateBlockGWidgetAttributes(
      wrap(` chat_data="${big}">
    <div>x</div>
    <g-widget-caption>Cap</g-widget-caption>
  </g-widget>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`chat_data`))).toBe(true)
  })

  it(`rejects a self-closing widget`, () => {
    const result = TemplateEngine.validateTemplate(`<g-base><g-widget/></g-base>`)
    expect(result.valid).toBe(false)
  })

  it(`rejects a caption outside the widget (positions)`, () => {
    const result = TemplateEngine.validateTemplate(`<g-base><g-widget-caption>Cap</g-widget-caption></g-base>`)
    expect(result.valid).toBe(false)
  })
})

describe(`widget-compiler`, () => {
  it(`interpolates caption, chat_data and dimensions, HTML stays raw`, () => {
    const compiled = TemplateEngine.compileBlockGWidget(dynamicTemplate)
    const widget = compiled.default?.default?.({orderId: `1042`, w: `320`, h: `240`})
    expect(widget?.caption).toBe(`Order <b>#1042</b>`)
    expect(widget?.chat_data).toBe(`{"order": "1042"}`)
    // Dynamic width/height stay raw strings after the pipeline (static ints
    // become numbers in the parser); renderWidget / assertWidget coerce via
    // Number() before sending / validating.
    expect(widget?.width).toBe(`320`)
    expect(widget?.height).toBe(`240`)
    expect(widget?.html).toBe(`<div>Order widget</div>`)
  })

  it(`passes JS object literals and template literals in the HTML through untouched`, () => {
    const compiled = TemplateEngine.compileBlockGWidget(regularTemplate)
    const widget = compiled.default?.default?.({})
    expect(widget?.html).toContain(`const cfg = {'key': 'val'};`)
    expect(widget?.html).toContain(`const t = \`hi \${name}\`;`)
    expect(widget?.caption).toBe(`Order <b>#1042</b> — tap to rate it`)
  })

  it(`applies filters in the caption`, () => {
    const compiled = TemplateEngine.compileBlockGWidget(`<g-base><g-widget><div>x</div><g-widget-caption>Order {{orderId|upper}}</g-widget-caption></g-widget></g-base>`)
    expect(compiled.default?.default?.({orderId: `ab12`})?.caption).toBe(`Order AB12`)
  })
})

describe(`widget-manager`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`compiles and serves a widget via getGWidget`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`rate`, dynamicTemplate)
    const widget = manager.getGWidget(`rate`, `default`, `default`, {orderId: `1042`, w: `320`, h: `240`})
    expect(widget.kind).toBe(`widget`)
    expect(widget.caption).toBe(`Order <b>#1042</b>`)
    expect(widget.chat_data).toBe(`{"order": "1042"}`)
    expect(widget.html).toBe(`<div>Order widget</div>`)
  })

  it(`throws for a missing widget`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGWidget(`empty`)).toThrow(/Widget function not found/)
  })

  it(`throws on an invalid widget template`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() =>
      manager.compile(
        `bad`,
        wrap(`>
    <div>x</div>
  </g-widget>`)
      )
    ).toThrow(/exactly one <g-widget-caption>/)
  })
})
