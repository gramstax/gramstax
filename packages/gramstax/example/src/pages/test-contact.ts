import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class TestContactPage extends CtxCore {
  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    const kb = this.kb()
    await this.editContact(kb)
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media lang="en" type="contact" phone="442071234567" first_name="England" last_name="idk" vcard="BEGIN:VCARD\\nVERSION:3.0\\nFN:England\\nTEL;TYPE=COUNTRY,VOICE:+442071234567\\nEND:VCARD"></media>
      <media lang="id" type="contact" phone="628123456789" first_name="Indonesia" last_name="ttk" vcard="BEGIN:VCARD\\nVERSION:3.0\\nFN:Indonesia\\nTEL;TYPE=COUNTRY,VOICE:+628123456789\\nEND:VCARD"></media>
    </base>
  `
}
