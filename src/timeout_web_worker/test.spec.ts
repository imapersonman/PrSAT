import { describe, test, expect, vi } from "vitest";
import { make_timeout_timer, TimeoutConfig } from "./interface";

describe('TimeoutTimer', () => {
  test('negative second', () => {
    const tt = make_timeout_timer()
    expect(() => tt.start(-29)).toThrow()
  })

  test('positive non-integer ms', () => {
    const tt = make_timeout_timer()
    expect(() => tt.start(4.4)).toThrow()
  })

  test('zero second already finished', async () => {
    const tt = make_timeout_timer()
    const at = tt.start(0)
    const cancel = vi.fn(at.cancel)

    await at.wait()

    expect(at.is_finished()).toEqual(true)
    expect(cancel).not.toHaveBeenCalled()
  })

  test('zero second calls on_finished', async () => {
    const tt = make_timeout_timer()
    const config: TimeoutConfig = { on_second: vi.fn((n) => {}), on_finished: vi.fn(() => {}) }
    const at = tt.start(0, config)

    await at.wait()

    expect(at.is_finished()).toEqual(true)
    expect(config.on_second).toHaveBeenCalledTimes(0)
    expect(config.on_finished).toHaveBeenCalled()
  })

  const expect_n_seconds = (start_seconds: number) => async () => {
    const tt = make_timeout_timer()

    const config: TimeoutConfig = {
      on_second: vi.fn((seconds_left) => {
        // expect(at.is_finished()).toEqual(false)
        expect(config.on_second).toHaveBeenCalledTimes((start_seconds - seconds_left) + 1)
        expect(config.on_finished).not.toHaveBeenCalled()
      }),
      on_finished: vi.fn(() => {}),
    }

    const at = tt.start(start_seconds, config)
    await at.wait()

    expect(at.is_finished()).toEqual(true)
    expect(config.on_second).toHaveBeenCalledTimes(start_seconds)
  }

  test('1 second', expect_n_seconds(1))
  test('3 seconds', expect_n_seconds(3))

  test('zero seconds cancel immediately does nothing', async () => {
    const tt = make_timeout_timer()
    const at = tt.start(0)
    const cancel = vi.spyOn(at, 'cancel')
    at.cancel()

    await at.wait()

    expect(at.is_finished()).toEqual(true)
    expect(cancel).toHaveBeenCalled()
  })

  test('1 second cancel immediately', async () => {
    const start_seconds = 1
    const tt = make_timeout_timer()

    const config: TimeoutConfig = {
      on_second: vi.fn((seconds_left) => {
        expect(seconds_left).toBeGreaterThan(0)
        // expect(at.is_finished()).toEqual(false)
        expect(config.on_second).toHaveBeenCalledTimes((start_seconds - seconds_left) + 1)
        expect(config.on_finished).not.toHaveBeenCalled()
      }),
      on_finished: vi.fn(() => {}),
    }

    const at = tt.start(start_seconds)
    at.cancel()

    await at.wait()

    expect(at.is_finished()).toEqual(true)
    expect(config.on_second).toHaveBeenCalledTimes(0)
  })

  test('2 seconds cancel 1 second in', async () => {
    const start_seconds = 4
    const seconds_in_to_cancel = 1
    const tt = make_timeout_timer()

    const config: TimeoutConfig = {
      on_second: vi.fn((seconds_left) => {
        expect(seconds_left).toBeGreaterThanOrEqual(0)
        // expect(at.is_finished()).toEqual(false)
        expect(config.on_second).toHaveBeenCalledTimes((start_seconds - seconds_left) + 1)
        expect(config.on_finished).not.toHaveBeenCalled()

        if (seconds_left === start_seconds - seconds_in_to_cancel) {
          at.cancel()
        }
      }),
      on_finished: vi.fn(() => {
        console.log('finished!')
      }),
    }

    const at = tt.start(start_seconds, config)

    await at.wait()

    expect(at.is_finished()).toEqual(true)
    expect(config.on_second).toHaveBeenCalledTimes((start_seconds - seconds_in_to_cancel) - 1)
  })
})
