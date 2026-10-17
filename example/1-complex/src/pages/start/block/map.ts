import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartBlockMapPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderText({
        keyboard: this.inlineKeyboardT([this, StartPage], `1`),
        data: {
          arr: Array.from({length: Math.floor(Math.random() * 4) + 3}, () => ({number: Math.random()})),
          status: 1,
          e: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`,
          i: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`
        }
      })
    },
    process: () => {}
  }

  static template = `
    <g-base>
      ${this.kbk.refresh_back()}
      <g-message>
        <b>🧭 Template map demo</b>

        <g-map src="arr" join="\\n\\n">
          Position: {{ord}}
          Number: {{e.number}}
          Status: {{status}}
        </g-map>
      </g-message>
      <g-message lang="id">
        <b>🧭 Demo map template</b>

        <g-map src="arr" join="\\n\\n">
          Posisi: {{ord}}
          Nomor: {{e.number}}
          Status: {{status}}
        </g-map>
      </g-message>
    </g-base>
  `
}
