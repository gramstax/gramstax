import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class CounterPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  kb() {
    return this.inlineKeyboardT([this.data.callback(`I`), this.data.callback(`D`), StartPage], `2`)
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
      <keyboard>➕ Increase, ➖ Decrease, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">➕ Tambah, ➖ Kurang, ${this.kbl.back.id}</keyboard>
      <message>
        🔢 Counter

        Current count: {{count}}

        Use Increase or Decrease to update the cached counter value.
      </message>
      <message lang="id">
        🔢 Kounter

        Jumlah saat ini: {{count}}

        Gunakan Tambah atau Kurang untuk memperbarui nilai kounter yang tersimpan.
      </message>
    </base>
  `
}
