import {PageBase} from "~/base/page"

export class StartTestMediaGroupPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      // ATTENTION: <g-media-group> is not support inline/bottom keyboard
      // const kb = ctx.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)], `1`, bi)
      await this.renderEditPhotoGroup()
    },
    process: () => {}
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
