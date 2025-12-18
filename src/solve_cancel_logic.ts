import { fallthrough, sleep } from "./utils"

// I should probably be running z3 inside of a worker.
// Then I could just kill it if it's taking too long to cancel normally.
// Whatever I'll just be weird and do this instead.

export const run_solve_cancel_logic = async <R>(
  on_run: (signal?: AbortSignal) => Promise<R>,
  on_cancel: () => Promise<R>,
  on_slow_cancel: () => Promise<R>,
  cancel_timeout_ms: number,  // amount of time into running on_cancel that we go ahead and call on_slow_cancel.
  abort_signal?: AbortSignal,
): Promise<R> => {
  // On cancel, attempt interrupt.
  // If the interrupt succeeds within a certain timeout, resolve with a 'cancel' status.
  // If the interrupt does NOT succeed within the timeout, resolve anyway with a 'cancel' status.
  // Otherwise everything else should resolve normally.

  // The ways the Promise can resolve:
  // - on_run finishes.
  // - abort_signal.abort event and on_cancel finishes before given cancel timeout.
  // - abort_signal.abort event and on_cancel finishes after given cancel timeout (on_slow_cancel).

  const user_cancel = new Promise<{ tag: 'cancelled' }>((resolve) => {
    abort_signal?.addEventListener('abort', () => {
      resolve({ tag: 'cancelled' })
    })
  })

  const run = on_run(abort_signal).then((r) => ({ tag: 'finished' as const, result: r }))
  const result = await Promise.race([
    run,
    user_cancel,
  ])

  if (result.tag === 'finished') {
    return result.result
  } else if (result.tag === 'cancelled') {
    const cancel_result = await on_cancel()
    const result = await Promise.race([
      // If we're at this point, just assume that the run finishes BECAUSE it was cancelled.
      // Ignore the result, though, as it's (best-case) garbage.
      run.then(() => ({ tag: 'finished' as const, result: cancel_result })),
      // on_cancel().then((r) => ({ tag: 'finished' as const, result: r })),
      sleep(cancel_timeout_ms).then(() => ({ tag: 'cancelled' as const })),
    ])

    if (result.tag === 'finished') {
      return result.result
    } else if (result.tag === 'cancelled') {
      return await on_slow_cancel()
    } else {
      return fallthrough('run_solve_cancel_logic', result)
    }
  } else {
    return fallthrough('run_solve_cancel_logic', result)
  }
}
