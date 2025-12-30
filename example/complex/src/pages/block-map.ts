import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class BlockMapPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, this.data.callbackData())
        .row()
        .text(arr[1]!, StartPage.data.callbackData())
    })
  }

  public async callback() {
    const data = {
      arr: Array.from({ length: Math.floor(Math.random() * 4) + 3 }, () => ({ number: Math.random() })),
      status: 1,
      e: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`,
      i: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`
    }
    await this.edit(this.kb(), data)
  }

  public static template = /*jsx*/ `
    <base>
      ${this.kbc.refreshBack()}
      <message>
        <b>Mapping data directly in template</b>

        <map src="arr" join="\\n\\n">
          Position: {~i+1~}
          Number: {{e.number}}
          Status: {{status}}
        </map>
      </message>
      <message lang="id">
        <b>Pemetaan data langsung di template</b>

        <map src="arr" join="\\n\\n">
          Posisi: {~i+1~}
          Nomor: {{e.number}}
          Status: {{status}}
        </map>
      </message>
    </base>
  `
}
