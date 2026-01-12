import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

export class StartPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, HelpPage.data.callbackData())
    })
  }

  async internal(edit = true) {
    const kb = this.kb()
    const data = {userName: this.userName}
    if (edit) {
      await this.edit(kb, data)
    } else {
      await this.reply(kb, data)
    }
  }

  async callback() {
    await this.internal(true)
  }

  async textCommand() {
    await this.internal(false)
  }

  static template = /*html*/ `
    <base id="with-import-and-you-can-use-components">
      <keyboard>❓ Help</keyboard>
      <keyboard lang="it">❓ Aiuto</keyboard>
      <keyboard lang="id">❓ Bantuan</keyboard>
    </base>
    <base>
      <import src="start" base="with-import-and-you-can-use-components" />
      <message>
        <b>Welcome to the bot {{userName}}</b>

        <b>❓ Help</b> - View help
      </message>
      <message lang="it">
        <b>Benvenuto nel Bot di {{userName}}</b>

        <b>❓ Aiuto</b> - Ottieni assistenza e informazioni
      </message>
      <message lang="id">
        <b>Selamat datang di bot {{userName}}</b>

        <b>❓ Bantuan</b> - Lihat bantuan
      </message>
    </base>
  `
}
