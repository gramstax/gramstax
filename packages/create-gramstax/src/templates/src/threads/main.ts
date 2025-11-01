import { isMainThread } from "bun"

export class MainThread {
  constructor(mainFunc: () => any) {
    if (isMainThread === true) {
      mainFunc()
    }
  }
}
