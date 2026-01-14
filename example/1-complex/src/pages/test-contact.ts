import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestContactPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback(`3`))
    })
  }

  async callback() {
    await this.editContact(this.kb())
  }

  static template = `
    <base>
      ${this.kbc.back()}
      <media type="contact" phone="442071234567" first_name="England" last_name="idk" vcard="BEGIN:VCARD\\nVERSION:3.0\\nFN:England\\nTEL;TYPE=COUNTRY,VOICE:+442071234567\\nEND:VCARD"></media>
      <media lang="id" type="contact" phone="628123456789" first_name="Indonesia" last_name="ttk" vcard="BEGIN:VCARD\\nVERSION:3.0\\nFN:Indonesia\\nTEL;TYPE=COUNTRY,VOICE:+628123456789\\nEND:VCARD"></media>
    </base>
  `
}
