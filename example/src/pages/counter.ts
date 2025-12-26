import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class CounterPage extends PageBase {
  public static data = this.buildData((exe: string = ``) => exe)

  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, this.data.callbackData(`I`))
        .text(arr[1]!, this.data.callbackData(`D`))
        .row()
        .text(arr[2]!, StartPage.data.callbackData())
    })
  }

  public async callbackPayload() {
    const execution = this.callbackDataPayload
    const kb = this.kb()
    const key = `${this.userId}`
    const data = ((await this.cacheData.get(key)) as string) || `0`

    let count
    if (execution == `I`) count = `${parseInt(data) + 1}`
    if (execution == `D`) count = `${parseInt(data) - 1}`

    await this.cacheData.set(key, count)
    await this.edit(kb, { count })
  }

  public async callback() {
    const kb = this.kb()
    const key = `${this.userId}`
    const count = (await this.cacheData.get(key)) || `0`

    await this.edit(kb, { count })
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Increase, Decrease, Back</keyboard>
      <keyboard lang="id" type="inline">Tambah, Kurang, Kembali</keyboard>

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
