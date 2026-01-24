import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {AdminGuard} from "~/guards/admin"

type BroadcastSession = {
  step?: `message` | `confirm`
  draft?: string
}

export class BroadcastPage extends PageBase {
  static data = this.buildData((action?: string) => [action])
  static BASE = {
    prompt: `prompt`,
    confirm: `confirm`,
    result: `result`,
    empty: `empty`,
    cancelled: `cancelled`,
    deliver: `deliver`
  }

  async callback() {
    await this.startBroadcast(true)
  }

  async textCommand() {
    await this.startBroadcast(false)
  }

  async callbackPayload() {
    const [action] = this.callbackDataPayloads
    if (!AdminGuard.isAdmin(this)) return null

    if (action === `send`) {
      return await this.handleSend()
    }
    if (action === `edit`) {
      return await this.handleEdit()
    }
    if (action === `cancel`) {
      return await this.handleCancel()
    }
    await this.startBroadcast(true)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    const {step} = this.getSessionParams()
    if (step !== `message`) return null

    const draft = this.msgText?.trim()
    if (!draft) {
      await this.sessionTextFree({step: `message`})
      return await this.reply(this.promptKeyboard(), {draft: `-`, isEmpty: true}, BroadcastPage.BASE.prompt)
    }

    await this.sessionTextFree({step: `confirm`, draft})
    await this.reply(this.confirmKeyboard(), {draft}, BroadcastPage.BASE.confirm)
  }

  private async handleSend() {
    const {draft} = this.getSessionParams()
    if (!draft) {
      await this.sessionTextFree({step: `message`})
      return await this.edit(this.promptKeyboard(), {draft: `-`, isEmpty: true}, BroadcastPage.BASE.prompt)
    }

    const subscribers = await this.db.listSubscribers()
    if (subscribers.length === 0) {
      await this.sessionClear()
      const kb = this.inlineKeyboardT([StartPage])
      return await this.edit(kb, {}, BroadcastPage.BASE.empty)
    }

    const ids = subscribers.map((item) => item.id)
    const langs = subscribers.map((item) => item.language || `default`)
    await this.broadcast(ids, langs, undefined, {message: draft}, BroadcastPage.BASE.deliver)
    await this.sessionClear()

    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, {count: subscribers.length}, BroadcastPage.BASE.result)
  }

  private async handleEdit() {
    const {draft} = this.getSessionParams()
    await this.sessionTextFree({step: `message`, draft})
    await this.edit(this.promptKeyboard(), {draft: draft || `-`, isEmpty: false}, BroadcastPage.BASE.prompt)
  }

  private async handleCancel() {
    await this.sessionClear()
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, {}, BroadcastPage.BASE.cancelled)
  }

  private async startBroadcast(edit: boolean) {
    if (!AdminGuard.isAdmin(this)) return null
    await this.sessionTextFree({step: `message`})
    const kb = this.promptKeyboard()
    if (edit) await this.edit(kb, {draft: `-`, isEmpty: false}, BroadcastPage.BASE.prompt)
    else await this.reply(kb, {draft: `-`, isEmpty: false}, BroadcastPage.BASE.prompt)
  }

  private promptKeyboard() {
    return this.inlineKeyboardT([this.data.callback(`cancel`), StartPage], `2`, BroadcastPage.BASE.prompt)
  }

  private confirmKeyboard() {
    return this.inlineKeyboardT([this.data.callback(`send`), this.data.callback(`edit`), this.data.callback(`cancel`), StartPage], `2-2`, BroadcastPage.BASE.confirm)
  }

  private getSessionParams() {
    return (this.session?.params as BroadcastSession | undefined) ?? {}
  }

  static template = `
    <base>
      ${this.kbk.home()}
    </base>

    <base id="${this.BASE.prompt}">
      <keyboard>${this.kbl.cancelHome.default}</keyboard>
      <keyboard lang="id">${this.kbl.cancelHome.id}</keyboard>
      <message>
        📣 Broadcast Message

        {~isEmpty ? "⚠️ Message cannot be empty.\\n" : ""~}
        Current draft: {{draft}}

        Send the announcement text now.
      </message>
      <message lang="id">
        📣 Pesan Siaran

        {~isEmpty ? "⚠️ Pesan tidak boleh kosong.\\n" : ""~}
        Draf saat ini: {{draft}}

        Kirim teks siaran sekarang.
      </message>
    </base>

    <base id="${this.BASE.confirm}">
      <keyboard>✅ Send, ✏️ Edit, ${this.kbl.cancelHome.default}</keyboard>
      <keyboard lang="id">✅ Kirim, ✏️ Edit, ${this.kbl.cancelHome.id}</keyboard>
      <message>
        ✅ Confirm broadcast

        {{draft}}
      </message>
      <message lang="id">
        ✅ Konfirmasi siaran

        {{draft}}
      </message>
    </base>

    <base id="${this.BASE.result}">
      <message>
        🎉 Broadcast sent

        Delivered to {{count}} subscribers.
      </message>
      <message lang="id">
        🎉 Siaran terkirim

        Dikirim ke {{count}} pelanggan.
      </message>
    </base>

    <base id="${this.BASE.empty}">
      <message>
        📭 No subscribers yet.
      </message>
      <message lang="id">
        📭 Belum ada pelanggan.
      </message>
    </base>

    <base id="${this.BASE.cancelled}">
      <message>
        ✖️ Broadcast cancelled.
      </message>
      <message lang="id">
        ✖️ Siaran dibatalkan.
      </message>
    </base>

    <base id="${this.BASE.deliver}">
      <message>
        📣 {{message}}
      </message>
      <message lang="id">
        📣 {{message}}
      </message>
    </base>
  `
}
