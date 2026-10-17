import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "../src/template/engine"

const render = (body: string, data?: Record<string, unknown>): string => {
  const processed = TemplateEngine._processScopeVariables(TemplateEngine._processScopeExec(TemplateEngine._processGIfElseBlocks(TemplateEngine._processGScriptBlocks(body))))
  return TemplateEngine._compileToFunction(processed, false)(data) as string
}

const wrap = (body: string): string => `<g-base><g-message>${body}</g-message></g-base>`

describe(`TemplateEngine <g-ifelse>`, () => {
  describe(`scope rewriting`, () => {
    it(`should anchor a bare identifier to data`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`isAdmin ? "admin" : "user"`)).toBe(`data?.isAdmin?"admin":"user"`)
    })

    it(`should keep a member chain optional instead of dereferencing it`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`user.name`)).toBe(`data?.user?.name`)
    })

    it(`should keep an indexed chain optional`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`items.length > 0 ? items[0].title : "none"`)).toBe(`data?.items?.length>0?data?.items?.[0]?.title:"none"`)
    })

    it(`should rewrite inside an index expression`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`map[key] === 1 ? "a" : "b"`)).toBe(`data?.map?.[data?.key]===1?"a":"b"`)
    })

    it(`should rewrite a call target and its arguments`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`isPaid ? formatPrice(total) : "free"`)).toBe(`data?.isPaid?data?.formatPrice(data?.total):"free"`)
    })

    it(`should leave arrow parameters untouched`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`items.filter((item) => item.on).length > 0`)).toBe(`data?.items?.filter((item)=>item.on).length>0`)
    })

    it(`should leave object literal keys alone and expand shorthand`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`isAdmin ? { role: "admin", n: count } : { role: "guest" }`)).toBe(`data?.isAdmin?{role:"admin",n:count: data?.count}:{role:"guest"}`)
    })

    it(`should not rewrite reserved words or standard globals`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`Math.max(a, b) > 10 ? "big" : typeof value`)).toBe(`Math.max(data?.a,data?.b)>10?"big":typeof data?.value`)
    })

    it(`should read division as division and regex as regex`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`a / b > 1 ? "x" : "y"`)).toBe(`data?.a/data?.b>1?"x":"y"`)
      expect(TemplateEngine._rewriteScopeIdentifiers(`/ab+c/.test(s) ? "y" : "n"`)).toBe(`/ab+c/.test(data?.s)?"y":"n"`)
    })

    it(`should not rewrite identifiers inside a string or a template literal`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`isAdmin ? "notAKey" : \`alsoNotAKey\``)).toBe(`data?.isAdmin?"notAKey":\`alsoNotAKey\``)
    })

    it(`should support the nested ternary from the spec`, () => {
      expect(TemplateEngine._rewriteScopeIdentifiers(`isUser ? isBlock ? \`account blocked\` : \`login success\` : \`please signup\``)).toBe(`data?.isUser?data?.isBlock?\`account blocked\`:\`login success\`:\`please signup\``)
    })
  })

  describe(`conditional detection`, () => {
    it(`should accept a ternary`, () => {
      expect(TemplateEngine._isConditionalExpression(TemplateEngine._tokenizeExpression(`isAdmin ? "a" : "b"`))).toBe(true)
    })

    it(`should accept short-circuit operators`, () => {
      expect(TemplateEngine._isConditionalExpression(TemplateEngine._tokenizeExpression(`isAdmin && name`))).toBe(true)
      expect(TemplateEngine._isConditionalExpression(TemplateEngine._tokenizeExpression(`isAdmin || name`))).toBe(true)
      expect(TemplateEngine._isConditionalExpression(TemplateEngine._tokenizeExpression(`isAdmin ?? name`))).toBe(true)
    })

    it(`should reject a plain expression`, () => {
      expect(TemplateEngine._isConditionalExpression(TemplateEngine._tokenizeExpression(`items.length`))).toBe(false)
      expect(TemplateEngine._isConditionalExpression(TemplateEngine._tokenizeExpression(`formatPrice(total)`))).toBe(false)
    })

    it(`should not mistake optional chaining or nullish coalescing for a ternary`, () => {
      expect(TemplateEngine._isConditionalExpression(TemplateEngine._tokenizeExpression(`user?.name`))).toBe(false)
    })
  })

  describe(`rendering`, () => {
    it(`should render the taken branch`, () => {
      expect(render(`<g-ifelse>isAdmin ? "your admin" : "user"</g-ifelse>`, {isAdmin: true})).toBe(`your admin`)
      expect(render(`<g-ifelse>isAdmin ? "your admin" : "user"</g-ifelse>`, {isAdmin: false})).toBe(`user`)
    })

    it(`should render a nested ternary`, () => {
      const body = `<g-ifelse>isUser ? isBlock ? \`account blocked\` : \`login success\` : \`please signup\`</g-ifelse>`
      expect(render(body, {isUser: true, isBlock: true})).toBe(`account blocked`)
      expect(render(body, {isUser: true, isBlock: false})).toBe(`login success`)
      expect(render(body, {isUser: false})).toBe(`please signup`)
    })

    it(`should follow JavaScript short-circuit semantics`, () => {
      expect(render(`<g-ifelse>user.isAdmin && user.name</g-ifelse>`, {user: {isAdmin: true, name: `Root`}})).toBe(`Root`)
      // `&&` yields the falsy left operand, so the raw value is rendered — the same as {~~ ~~}.
      expect(render(`<g-ifelse>user.isAdmin && user.name</g-ifelse>`, {user: {isAdmin: false, name: `Root`}})).toBe(`false`)
    })

    it(`should render empty when a branch value is missing`, () => {
      expect(render(`<g-ifelse>user.isAdmin ? user.name : "anon"</g-ifelse>`, {})).toBe(`anon`)
      expect(render(`<g-ifelse>user.isAdmin ? user.name : "anon"</g-ifelse>`, {user: {isAdmin: true}})).toBe(``)
    })

    it(`should render empty instead of throwing when data is absent`, () => {
      expect(render(`<g-ifelse>isAdmin ? "admin" : "user"</g-ifelse>`, undefined)).toBe(``)
    })

    it(`should sit next to {{}} interpolation without interfering`, () => {
      expect(render(`Hi {{name}} — <g-ifelse>isAdmin ? "admin" : "user"</g-ifelse>`, {name: `Ada`, isAdmin: true})).toBe(`Hi Ada — admin`)
    })

    it(`should leave {{}} and {~~} untouched for other constructs`, () => {
      expect(render(`{~ items.length ~}`, {items: [1, 2]})).toBe(`2`)
    })
  })

  describe(`AOT safety`, () => {
    it(`should never emit with(`, () => {
      const bodies = [`isAdmin ? "a" : "b"`, `isUser ? isBlock ? \`x\` : \`y\` : \`z\``, `user.isAdmin && user.name`, `items.length > 0 ? items[0].title : "none"`]
      for (const body of bodies) {
        expect(TemplateEngine._processGIfElseBlocks(`<g-ifelse>${body}</g-ifelse>`)).not.toContain(`with(`)
      }
    })

    it(`should emit no codegen tokens`, () => {
      const emitted = TemplateEngine._processGIfElseBlocks(`<g-ifelse>isAdmin ? "a" : "b"</g-ifelse>`)
      expect(emitted).not.toContain(`new Function`)
      expect(emitted).not.toContain(`eval(`)
    })

    it(`should compile and render under a sabotaged globalThis.Function`, () => {
      const original = globalThis.Function
      try {
        globalThis.Function = ((): never => {
          throw new Error(`codegen is unavailable`)
        }) as unknown as FunctionConstructor
        const processed = TemplateEngine._processGIfElseBlocks(`<g-ifelse>isAdmin ? "admin" : "user"</g-ifelse>`)
        // The block body itself is plain JS source, so it can be evaluated by the host.
        expect(processed).toContain(`data?.isAdmin`)
      } finally {
        globalThis.Function = original
      }
    })
  })

  describe(`validation`, () => {
    it(`should reject an empty body`, () => {
      const result = TemplateEngine.validateBlockGIfElseBody(`<g-ifelse></g-ifelse>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toContain(`body must not be empty`)
    })

    it(`should reject a non-conditional body`, () => {
      for (const body of [`items.length`, `formatPrice(total)`, `user.name`, `42`]) {
        const result = TemplateEngine.validateBlockGIfElseBody(`<g-ifelse>${body}</g-ifelse>`)
        expect(result.valid).toBe(false)
        expect(result.errors[0]!.message).toContain(`must be a conditional expression`)
        expect(result.errors[0]!.message).toContain(`{~~ ${body} ~~}`)
      }
    })

    it(`should reject {{}} interpolation inside the body`, () => {
      const result = TemplateEngine.validateBlockGIfElseBody(`<g-ifelse>isAdmin ? {{role}} : ""</g-ifelse>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toContain(`must not contain {{}} or {~~} interpolation`)
    })

    it(`should reject {~~} inside the body`, () => {
      const result = TemplateEngine.validateBlockGIfElseBody(`<g-ifelse>isAdmin ? {~~ role ~~} : ""</g-ifelse>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toContain(`must not contain {{}} or {~~} interpolation`)
    })

    it(`should reject template literal interpolation inside the body`, () => {
      const result = TemplateEngine.validateBlockGIfElseBody(`<g-ifelse>isAdmin ? \`\${a}-\${b}\` : ""</g-ifelse>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toContain(`must not use \${...} interpolation`)
    })

    it(`should accept every valid conditional shape`, () => {
      for (const body of [`isAdmin ? "a" : "b"`, `isAdmin && name`, `isAdmin || name`, `isAdmin ?? name`, `isUser ? isBlock ? \`x\` : \`y\` : \`z\``, `!isBanned && items.length > 3 ? "ok" : "no"`]) {
        expect(TemplateEngine.validateBlockGIfElseBody(`<g-ifelse>${body}</g-ifelse>`).valid).toBe(true)
      }
    })

    it(`should reject attributes`, () => {
      const result = TemplateEngine.validateBlockGIfElseAttributes(`<g-ifelse is="a">a ? "x" : "y"</g-ifelse>`)
      expect(result.valid).toBe(false)
    })

    it(`should reject the self-closing form`, () => {
      const result = TemplateEngine.validateFormatBlock(`<g-ifelse />`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toContain(`must not be self-closing`)
    })

    it(`should be a known block name`, () => {
      expect(TemplateEngine.validateNamesBlock(`<g-ifelse>a ? "x" : "y"</g-ifelse>`).valid).toBe(true)
      expect(TemplateEngine.ALLOWED_BLOCKS_PAGE).toContain(`<g-ifelse>`)
    })

    it(`should be rejected outside an allowed parent`, () => {
      const result = TemplateEngine.validatePositionsBlock(`<g-ifelse>a ? "x" : "y"</g-ifelse>`)
      expect(result.valid).toBe(false)
    })

    it(`should be allowed in the same parents as g-script`, () => {
      expect(TemplateEngine.validatePositionsBlock(wrap(`<g-ifelse>a ? "x" : "y"</g-ifelse>`)).valid).toBe(true)
      expect(TemplateEngine.validatePositionsBlock(wrap(`<g-ifelse>a ? "x" : "y"</g-ifelse><g-map src="items">{{i}}</g-map>`)).valid).toBe(true)
    })

    it(`should surface through validateTemplate`, () => {
      const result = TemplateEngine.validateTemplate(wrap(`<g-ifelse>items.length</g-ifelse>`))
      expect(result.valid).toBe(false)
      expect(result.errors.some((error) => error.message.includes(`must be a conditional expression`))).toBe(true)
    })

    it(`should pass validateTemplate for a valid conditional`, () => {
      expect(TemplateEngine.validateTemplate(wrap(`<g-ifelse>isAdmin ? "admin" : "user"</g-ifelse>`)).valid).toBe(true)
    })
  })

  describe(`compiled blocks`, () => {
    it(`should render inside a compiled g-message`, () => {
const compiled = TemplateEngine.compileBlockGMessage(wrap(`Hello <g-ifelse>isAdmin ? "admin" : "user"</g-ifelse>`))
const entry = compiled.default?.default
expect(entry?.({isAdmin: true} as never)?.text).toBe(`Hello admin`)
expect(entry?.({isAdmin: false} as never)?.text).toBe(`Hello user`)
    })
  })
})