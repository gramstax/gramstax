import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Shows a single item by ID.
export class DetailPage extends PageBase {
  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree()
    const bi = `form`
    await this.edit(this.kb(`${bi}-kb`), {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.handleDetail(this.msgText)
  }

  private async handleDetail(input?: string) {
    const id = input?.trim()
    if (!id) {
      const bi = `invalid`
      await this.reply(this.kb(`${bi}-kb`), {}, bi)
      await this.sessionClear()
      return
    }

    const item = this.crudStore.getItem(this.userId, id)
    if (!item) {
      const bi = `not-found`
      await this.reply(this.kb(`${bi}-kb`), {id}, bi)
      await this.sessionClear()
      return
    }

    const createdAt = this.crudStore.formatTimestamp(item.createdAt)
    const updatedAt = this.crudStore.formatTimestamp(item.updatedAt)
    const bi = `detail`
    await this.reply(this.kb(`${bi}-kb`), {id: item.id, title: item.title, description: item.description, status: item.status, createdAt, updatedAt}, bi)
    await this.sessionClear()
  }

  static template = `
    <base id="form">
      <message>
        🔎 View item details

        Enter the item ID.
        Example: 1
      </message>
      <message lang="id">
        🔎 Lihat detail item

        Masukkan ID item.
        Contoh: 1
      </message>
    </base>

    <base id="detail">
      <message>
        📋 Item #{{id}}

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}
        🕒 Created: {{createdAt}}
        🔄 Updated: {{updatedAt}}
      </message>
      <message lang="id">
        📋 Item #{{id}}

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}
        🕒 Dibuat: {{createdAt}}
        🔄 Diperbarui: {{updatedAt}}
      </message>
    </base>

    <base id="not-found">
      <message>
        ❌ Item not found: {{id}}
      </message>
      <message lang="id">
        ❌ Item tidak ditemukan: {{id}}
      </message>
    </base>

    <base id="invalid">
      <message>
        ⚠️ Invalid ID.

        Please send a numeric item ID.
      </message>
      <message lang="id">
        ⚠️ ID tidak valid.

        Mohon kirim ID item angka.
      </message>
    </base>

    <base id="form-kb">
      ${this.kbk.cancel()}
    </base>

    <base id="detail-kb">
      ${this.kbk.home()}
    </base>

    <base id="not-found-kb">
      ${this.kbk.cancel()}
    </base>

    <base id="invalid-kb">
      ${this.kbk.cancel()}
    </base>
  `
}
