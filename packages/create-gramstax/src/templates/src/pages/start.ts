import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

export class StartPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([HelpPage])
    const data = {userName: this.userName}
    if (edit) await this.edit(kb, data)
    else await this.reply(kb, data)
  }

  async callback() {
    await this.show(true)
  }

  async textCommand() {
    await this.show(false)
  }

  static template = `
    <base>
      <import src="start" base="with-import-and-you-can-use-components" />
      <message>
        <b>Welcome to the bot {{userName}}</b>

        <b>❓ Help</b> - View help
      </message>
      <message lang="id">
        <b>Selamat datang di bot {{userName}}</b>

        <b>❓ Bantuan</b> - Lihat bantuan
      </message>
    </base>
  `
}
