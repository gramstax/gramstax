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

        {~created ? \`Welcome, \${name}! You are now on the newsletter list and will receive announcements, product updates, and important notices.\` : 'You are already on the list, so no changes are needed. Stay tuned for the next update.'~}
      </message>
      <message lang="id">
        {~created ? '✅ Langganan berhasil' : '💚 Anda sudah berlangganan.'~}

        {~created ? \`Selamat datang, \${name}! Anda sudah terdaftar dan akan menerima pengumuman, pembaruan produk, serta informasi penting berikutnya.\` : 'Anda sudah terdaftar, jadi tidak ada perubahan. Nantikan pembaruan selanjutnya.'~}
      </message>
    </base>
  `
}
