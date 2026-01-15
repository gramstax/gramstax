import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class CounterPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  kb() {
    return this.inlineKeyboard((k, a) => {
      return k //
        .text(a[0]!, this.data.callback(`I`))
        .text(a[1]!, this.data.callback(`D`))
        .row()
        .text(a[2]!, StartPage.data.callback())
    })
  }

  async callbackPayload() {
    const execution = this.callbackDataPayload
    const kb = this.kb()
    const key = `${this.userId}`
    const data = ((await this.cacheData.get(key)) as string) || `0`

    let count
    if (execution == `I`) count = `${parseInt(data) + 1}`
    if (execution == `D`) count = `${parseInt(data) - 1}`

    await this.cacheData.set(key, count)
    await this.edit(kb, {count})
  }

  async callback() {
    const kb = this.kb()
    const key = `${this.userId}`
    const count = (await this.cacheData.get(key)) || `0`

    await this.edit(kb, {count})
  }

  static template = `
    <base>
      <keyboard>Increase, Decrease, ${this.kbl.back(`default`)}</keyboard>
      <keyboard lang="id">Tambah, Kurang, ${this.kbl.back(`id`)}</keyboard>
      <message>
        Count: {{count}}

        This is test for dynamic condition case counter with cache
      </message>
      <message lang="id">
        Jumlah: {{count}}

        Ini adalah test kondisi dinamis kasus kounter dengan cache
      </message>
    </base>
  `
}
