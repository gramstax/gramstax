import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: BlockMapPage) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([ctx, StartPage], `1`, bi)
    const da = {
      arr: Array.from({length: Math.floor(Math.random() * 4) + 3}, () => ({number: Math.random()})),
      status: 1,
      e: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`,
      i: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`
    }
    await ctx.edit(kb, da, bi)
  }
}

export class BlockMapPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.refresh_back()}
      <message>
        <b>🧭 Template map demo</b>

        <map src="arr" join="\\n\\n">
          Position: {~i - -1~}
          Number: {{e.number}}
          Status: {{status}}
        </map>
      </message>
      <message lang="id">
        <b>🧭 Demo map template</b>

        <map src="arr" join="\\n\\n">
          Posisi: {~i - -1~}
          Nomor: {{e.number}}
          Status: {{status}}
        </map>
      </message>
    </base>
  `
}
