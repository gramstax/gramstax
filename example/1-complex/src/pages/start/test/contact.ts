import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestContactPage extends PageBase {
  static data = this.buildData()
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditContact(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="contact" phone="442071234567" first_name="England" last_name="idk" vcard="BEGIN:VCARD\\nVERSION:3.0\\nFN:England\\nTEL;TYPE=COUNTRY,VOICE:+442071234567\\nEND:VCARD">
        👤 Contact demo
        
        This sends a contact card as a reply.
      </g-media>
      <g-media lang="id" type="contact" phone="628123456789" first_name="Indonesia" last_name="ttk" vcard="BEGIN:VCARD\\nVERSION:3.0\\nFN:Indonesia\\nTEL;TYPE=COUNTRY,VOICE:+628123456789\\nEND:VCARD">
        👤 Demo kontak
        
        Ini mengirim kartu kontak sebagai balasan.
      </g-media>
    </g-base>
  `
}
