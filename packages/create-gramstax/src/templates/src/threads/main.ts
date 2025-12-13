import { isMainThread } from "bun"

export class MainThread {
  constructor(wrapCode: () => any) {
    if (isMainThread === true) {
      wrapCode()
    }
  }
}
