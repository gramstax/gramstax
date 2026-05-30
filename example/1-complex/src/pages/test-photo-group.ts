import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: TestPhotoGroupPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editPhotoGroup(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestPhotoGroupPage) {
    throw ctx
  }
}

export class TestPhotoGroupPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
      ${this.kbk.back()}
      <media-group>
        <media lang="en" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
          🖼️ Photo group demo
          
          ENGLISH This is caption first photo
        </media>
        <media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
          🖼️ Demo grup foto
          
          Ini adalah caption pertama.
        </media>
        <media shared="true" type="photo" src="https://www.w3schools.com/html/pic_trulli.jpg"></media>
      </media-group>
    </base>
  `
}
