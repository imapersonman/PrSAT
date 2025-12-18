import { describe, test, expect } from "vitest"
import { sleep } from "./utils"
import { run_solve_cancel_logic } from "./solve_cancel_logic"

describe('solve stuff', () => {
  type R = 'finished' | 'cancelled' | 'slow-cancelled'
  const test_cancel = async (
    config: {
      time_before_cancel_ms: number,
      cancel_timeout_ms: number,
      time_to_actually_cancel_ms: number,
      ignore_abort: boolean,
      fudge_ms: number,
    },
    expected_result: R,
  ) => {
    const on_run_timeout = config.time_before_cancel_ms * 200
    const expected_cancel_time = config.time_before_cancel_ms +
      (expected_result === 'slow-cancelled' ? config.cancel_timeout_ms : config.time_to_actually_cancel_ms)
    const ac =  new AbortController

    const on_run = async (signal?: AbortSignal): Promise<R> => {
      const inner_controller = new AbortController()
      const inner_on_cancel = async () => {
        // wait a bit before actually aborting.
        await sleep(config.time_to_actually_cancel_ms)
        if (!config.ignore_abort) {
          inner_controller.abort()  // don't actually abort!
        }
      }
      signal?.addEventListener('abort', inner_on_cancel)
      await sleep(on_run_timeout, inner_controller.signal)
      return 'finished'
    }
    const on_cancel = async (): Promise<R> => 'cancelled'
    const on_slow_cancel = async (): Promise<R> => 'slow-cancelled'

    const start = performance.now()
    const [result] = await Promise.all([
      run_solve_cancel_logic(on_run, on_cancel, on_slow_cancel, config.cancel_timeout_ms, ac.signal),
      (async () => {
        await sleep(config.time_before_cancel_ms)
        ac.abort()
      })(),
    ])
    expect(result).toEqual(expected_result)  // slow-cancelled because on_cancel clearly didn't work if on_run is still going.
    const actual_time = performance.now() - start

    expect(Math.abs(actual_time - expected_cancel_time)).toBeLessThan(config.fudge_ms)
  }

  test('cancel within cancel timeout', async () => {
    await test_cancel({
      time_before_cancel_ms: 10,
      cancel_timeout_ms: 50,
      time_to_actually_cancel_ms: 30,
      fudge_ms: 20,
      ignore_abort: false,
    }, 'cancelled')
  })
  test('cancel after cancel timeout', async () => {
    await test_cancel({
      time_before_cancel_ms: 10,
      cancel_timeout_ms: 50,
      time_to_actually_cancel_ms: 60,
      fudge_ms: 20,
      ignore_abort: false,
    }, 'slow-cancelled')
  })

  test('cancel within cancel timeout, but solve ignores the signal', async () => {
    await test_cancel({
      time_before_cancel_ms: 10,
      cancel_timeout_ms: 50,
      time_to_actually_cancel_ms: 30,
      fudge_ms: 20,
      ignore_abort: true,
    }, 'slow-cancelled')
  })
  test('cancel after cancel timeout, but solve ignores the signal', async () => {
    await test_cancel({
      time_before_cancel_ms: 10,
      cancel_timeout_ms: 50,
      time_to_actually_cancel_ms: 60,
      fudge_ms: 20,
      ignore_abort: true,
    }, 'slow-cancelled')
  })
})