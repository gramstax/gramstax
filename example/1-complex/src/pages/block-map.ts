import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: BlockMapPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ctx, StartPage], `1`, bi)
    const da = {
      arr: Array.from({length: Math.floor(Math.random() * 4) + 3}, () => ({number: Math.random()})),
      status: 1,
      e: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`,
      i: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`
    }
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: BlockMapPage) {
    throw ctx
  }
}

export class BlockMapPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.refresh_back()}
      <g-message>
        <b>🧭 Template map demo</b>

        <g-map src="arr" join="\\n\\n">
          Position: {~i - -1~}
          Number: {{e.number}}
          Status: {{status}}
        </g-map>
      </g-message>
      <g-message lang="id">
        <b>🧭 Demo map template</b>

        <g-map src="arr" join="\\n\\n">
          Posisi: {~i - -1~}
          Nomor: {{e.number}}
          Status: {{status}}
        </g-map>
      </g-message>
    </g-base>
  `
}
