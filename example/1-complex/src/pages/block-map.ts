import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockMapPage extends PageBase {
  async handleCallbackData() {
    const kb = this.inlineKeyboardT([this, StartPage])
    const data = {
      arr: Array.from({length: Math.floor(Math.random() * 4) + 3}, () => ({number: Math.random()})),
      status: 1,
      e: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`,
      i: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`
    }
    await this.edit(kb, data)
  }

  static template = `
    <base>
      ${this.kbk.refreshBack()}
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
