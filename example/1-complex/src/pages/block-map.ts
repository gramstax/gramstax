import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockMapPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k //
        .text(a[0]!, this.data.callback())
        .row()
        .text(a[1]!, StartPage.data.callback())
    })
  }

  async callback() {
    const data = {
      arr: Array.from({length: Math.floor(Math.random() * 4) + 3}, () => ({number: Math.random()})),
      status: 1,
      e: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`,
      i: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`
    }
    await this.edit(this.kb(), data)
  }

  static template = `
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
