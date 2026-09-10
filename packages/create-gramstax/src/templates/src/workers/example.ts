import {WorkerThreadInit} from "@gramstax/worker-thread"

export class ExampleWorker extends WorkerThreadInit {
  async mtdExample(input: string) {
    return {echo: input, threadId: this.id}
  }
}
