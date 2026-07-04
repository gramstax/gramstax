import {PageBase} from "~/base/page"

class Main {
  static async showIndex(ctx: TestMediaGroupPage) {
    // ATTENTION: <g-media-group> is not support inline/bottom keyboard
    // const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editPhotoGroup(da)
  }
}

export class TestMediaGroupPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media-group>
        <g-media lang="en" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
          🖼️ Global Media Group
          
          1. ENGLISH This is caption first media
        </g-media>
        <g-media lang="en" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
          🖼️ Photo
          
          2. ENGLISH This is caption first media
        </g-media>
        <g-media lang="en" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
          🖼️ Video
          
          3. ENGLISH This is caption two media
        </g-media>
        <g-media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
          🖼️ Global Media Grup
          
          Ini adalah caption pertama.
        </g-media>
        <g-media shared="true" type="photo" src="https://www.w3schools.com/html/pic_trulli.jpg"></g-media>
      </g-media-group>
    </g-base>
  `
}
