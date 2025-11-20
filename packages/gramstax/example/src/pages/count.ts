import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class CounterPage extends CtxCore {
  static data = this.buildData((execution?: string) => execution)

  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return (
        kb
          //
          .text(arr[0], this.data.callbackData(`I`))
          .text(arr[1], this.data.callbackData(`D`))
          .row()
          .text(arr[2], StartPage.data.callbackData())
      )
    })
  }

  public async callbackPayload() {
    const execution = this.callbackDataPayload
    const kb = this.kb()
    const key = `${this.userid}`
    const data = (await this.cacheData.get(key)) || 0

    let count
    if (execution == `I`) count = `${parseInt(data) + 1}`
    if (execution == `D`) count = `${parseInt(data) - 1}`

    await this.cacheData.set(key, count)
    await this.edit(kb, { count })
  }

  public async callback() {
    const kb = this.kb()
    const key = `${this.userid}`
    const count = (await this.cacheData.get(key)) || 0
    await this.edit(kb, { count })
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">Increase, Decrease, Back</keyboard>
      <keyboard lang="id" type="inline">Tambah, Kurang, Kembali</keyboard>

      <message lang="en">
        Count: {{count}}

        This is test for dynamic condition with case counter
      </message>

      <message lang="id">
        Jumlah: {{count}}

        Ini adalah test kondisi dinamis dengan kasus kounter
      </message>
    </base>
  `
}
