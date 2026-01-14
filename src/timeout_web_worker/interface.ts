import { assert, assert_exists } from "../utils"

export type ActiveTimeout = {
  wait(): Promise<void>
  cancel(): void
  is_finished(): boolean
}

export type TimeoutConfig = {
  // on_second is called whenever the number of seconds left is greater than zero,
  // on_finished is called when it is equal to zero.
  on_second?: (seconds_left: number) => void
  on_finished?: () => void
}

export interface TimeoutTimer {
  start(start_seconds: number, config?: TimeoutConfig): ActiveTimeout
}

export const make_timeout_timer = (): TimeoutTimer => {
  return new SimpleTimeoutTimer()
}

class SimpleTimeoutTimer implements TimeoutTimer {
  start(start_seconds: number, config?: TimeoutConfig): ActiveTimeout {
    assert(Number.isInteger(start_seconds))
    assert(start_seconds >= 0)

    let time_left_seconds = start_seconds
    let cancelled = false

    let interval: ReturnType<typeof setInterval> | undefined = undefined
    let pfuncs: {
      resolve: (value: void | PromiseLike<void>) => void,
      reject: (reason?: any) => void,
    } | undefined = undefined

    const promise = new Promise<void>((resolve, reject) => {
      pfuncs = { resolve, reject }
      if (start_seconds === 0) {
        config?.on_finished?.()
        resolve()
      } else {
        config?.on_second?.(time_left_seconds)
        interval = setInterval(() => {
          try {
            time_left_seconds--
            if (time_left_seconds === 0) {
              config?.on_finished?.()
              assert_exists(interval).close()
              resolve()
            } else {
              config?.on_second?.(time_left_seconds)
            }
          } catch (e) {
            reject(e)
          }
        }, 1000)
      }
    })

    const is_finished = (): boolean => {
      return cancelled || time_left_seconds === 0
    }

    return {
      wait() {
        return promise
      },
      cancel() {
        if (!is_finished()) {
          cancelled = true
          interval?.close()
          assert_exists(pfuncs).resolve()
        }
      },
      is_finished,
    }
  }
}

class WebWorkerTimeoutTimer implements TimeoutTimer {
  start(start_seconds: number, config?: TimeoutConfig): ActiveTimeout {
    throw new Error("Method not implemented.")
  }
}
