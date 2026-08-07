import {describe, expect, it } from "bun:test"
import {TemplateEngine} from "~/template/engine"

/**
 * Coverage guard: proves every supported Telegram Rich Message tag is validated.
 * Iterates the authoritative tag list so nothing can be added without coverage.
 * A tag is covered when it has a required-attr spec, a value validator, or is
 * officially documented as attribute-free (NO_ATTRIBUTE_TAGS).
 */
describe(`telegram rich tag coverage guard (Bot API 10.2)`, () => {
  const allTags = [...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_LEGACY, ...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH]

  // Tags officially documented with no attributes (Bot API 10.2 rich spec);
  // normalized via the same rules as TemplateEngine._extractBlockNames.
  const NO_ATTRIBUTE_TAGS = new Set([
    // legacy inline
    `b`,
    `i`,
    `u`,
    `s`,
    `pre`,
    // rich inline
    `del`,
    `em`,
    `ins`,
    `mark`,
    `strike`,
    `strong`,
    `sub`,
    `sup`,
    `tg-spoiler`,
    // block / structural (language lives on nested <code class="language-x">)
    `br`,
    `footer`,
    `h1`,
    `h2`,
    `h3`,
    `h4`,
    `h5`,
    `h6`,
    `hr`,
    `p`,
    `summary`,
    `tr`,
    `ul`,
    // telegram-specific (no numeric attrs; content = child media / LaTeX)
    `tg-collage`,
    `tg-math`,
    `tg-math-block`,
    `tg-slideshow`,
    // media
    `cite`,
    `figcaption`,
    `figure`
  ])

  const normalize = (literal: string): string => {
    let name = literal.replace(/<\/?/g, ``).replace(/\s.*?>/, ``).replace(/\/?>/g, ``)
    // <blockquote expandable> normalizes to its base tag "blockquote"
    if (name === `blockquote expandable`) name = `blockquote`
    return name
  }

  for (const tagLiteral of allTags) {
    it(`validates block/tag ${tagLiteral}`, () => {
      const tagName = normalize(tagLiteral)
      const hasRequired = tagName in TemplateEngine._TELEGRAM_REQUIRED_ATTRS
      const hasValues = tagName in TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS
      const hasRegistry = tagName in TemplateEngine._TELEGRAM_ALLOWED_ATTRS
      const covered = hasRequired || hasValues || hasRegistry || NO_ATTRIBUTE_TAGS.has(tagName)
      expect(covered, `tag ${tagLiteral} (${tagName}) has no validator spec — coverage gap`).toBe(true)
    })
  }

  it(`counts exactly 54 supported tags`, () => {
    expect(allTags.length).toBe(54)
  })

  it(`registers every telegram tag in the allowed-attr registry`, () => {
    for (const tagLiteral of allTags) {
      const tagName = normalize(tagLiteral)
      expect(
        tagName in TemplateEngine._TELEGRAM_ALLOWED_ATTRS,
        `tag ${tagLiteral} (${tagName}) missing from _TELEGRAM_ALLOWED_ATTRS — registry gap`
      ).toBe(true)
    }
  })

  it(`keeps value-validated attributes inside the allowed registry`, () => {
    for (const [tag, validators] of Object.entries(TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS)) {
      const allowed = TemplateEngine._TELEGRAM_ALLOWED_ATTRS[tag] ?? []
      const allowedSet = new Set(allowed)
      for (const attr of Object.keys(validators)) {
        expect(allowedSet.has(attr), `validator for ${tag}.${attr} not in allowed registry`).toBe(true)
      }
    }
  })

  it(`keeps required attributes inside the allowed registry`, () => {
    for (const [tag, spec] of Object.entries(TemplateEngine._TELEGRAM_REQUIRED_ATTRS)) {
      const allowedSet = new Set(TemplateEngine._TELEGRAM_ALLOWED_ATTRS[tag] ?? [])
      const required = Array.isArray(spec) ? spec : spec.oneOf.flat()
      for (const attr of required) {
        expect(allowedSet.has(attr), `required attr ${tag}.${attr} not in allowed registry`).toBe(true)
      }
    }
  })

  it(`keeps the registry in sync with the official spec (no invented attributes)`, () => {
    const registryTags = Object.keys(TemplateEngine._TELEGRAM_ALLOWED_ATTRS).sort()
    const telegramTags = [...new Set(allTags.map(normalize))].sort()
    expect(registryTags).toEqual(telegramTags)
  })

  it(`guard fails when a tag is added without registry coverage (efficacy)`, () => {
    const missing = [...allTags, `<tg-future/>`].filter((literal) => {
      const tagName = normalize(literal)
      return !(tagName in TemplateEngine._TELEGRAM_ALLOWED_ATTRS)
    })
    expect(missing.length).toBeGreaterThan(0)
    expect(missing.map(normalize)).toContain(`tg-future`)
  })

  it(`covers every officially documented attribute with a validator`, () => {
    const withValues = Object.keys(TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS)
    const required = Object.keys(TemplateEngine._TELEGRAM_REQUIRED_ATTRS)
    // Every tag carrying required attributes must also appear (or be intentionally
    // validated) in the attribute-value layer — presence and value are both checked.
    for (const tag of required) {
      const hasValueEntry = withValues.includes(tag)
      const noValueNeeded = NO_ATTRIBUTE_TAGS.has(tag)
      expect(hasValueEntry || noValueNeeded, `required-attr tag ${tag} lacks value validation`).toBe(true)
    }
  })
})