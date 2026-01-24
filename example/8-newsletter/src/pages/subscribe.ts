import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class SubscribePage extends PageBase {
  async callback() {
    const {created} = await this.db.subscribe(this.userId, {
      userName: this.userName,
      fullName: this.userFullName,
      language: this.userLanguage
    })

    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, {name: this.userFirstName, created})
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        {~created ? '✅ Subscription confirmed' : '💚 You are already subscribed.'~}

        {~created ? \`Welcome, \${name}! You will receive future broadcasts.\` : ''~}
      </message>
      <message lang="id">
        {~created ? '✅ Langganan berhasil' : '💚 Anda sudah berlangganan.'~}

        {~created ? \`Selamat datang, \${name}! Anda akan menerima siaran berikutnya.\` : ''~}
      </message>
    </base>
  `
}
