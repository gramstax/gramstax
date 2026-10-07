import {Db} from "~/db"
import {JobWorker} from "~/workers/job"

export class ServicesCore {
  /**
   * Bring up a database and a worker thread. A freshly generated bot then starts with its optional
   * services already live, instead of leaving the wiring as an exercise for the
   * author.
   *
   * Called from `BotCore.hookAfterStart`.
   */
  static async start(): Promise<void> {
    await Db.start()
    await JobWorker.launchWorker()
  }

  /**
   * Shut those services down. Called from `BotCore.stop`.
   *
   * Workers stop before the database: a tick can still be mid-read, and tearing
   * the store down underneath it would turn an orderly stop into an LMDB error.
   */
  static async stop(): Promise<void> {
    try {
      await JobWorker.shutdown(1_000)
    } catch {
      // Never launched — startup failed, or a test drove the bot straight to
      // stop. shutdown() throws in that case, and that is not a failure here.
    }
    await Db.stop()
  }
}
