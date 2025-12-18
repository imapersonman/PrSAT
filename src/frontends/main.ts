import { Editable, rEditable } from '../editable';
import { el, math_el, tel } from "../el";
import { assert, assert_exists, fallthrough, sleep } from "../utils";
import { parse_constraint, parse_constraint_or_real_expr } from "../parser";
import { constraint_to_string, letter_string, TruthTable, variables_in_constraints } from "../pr_sat";
import { FancyEvaluatorOutput, init_z3, ModelAssignmentOutput, pr_sat_wrapped, PrSATResult, WrappedSolver, WrappedSolverResult } from "../z3_integration";
import { s_to_string } from "../s";
import { ConstraintOrRealExpr, PrSat } from "../types";
import { InputBlockLogic } from "../display_logic";
import { constraint_to_html, real_expr_to_html, state_id } from "../prsat_to_html";
import { generic_input_block, split_input, SplitInput } from "../block_playground";

import * as TestId from '../../tests/test_ids'
import * as Constants from '../constants'

import '../style.css'
import { download } from '../download';
import { SolverStateMachine } from '../solver';
import { BaseSolver } from '../solver/basic';

const root = assert_exists(document.getElementById('app'), 'Root element with id \'#app\' doesn\'t exist!')

type Constraint = PrSat['Constraint']

// https://stackoverflow.com/questions/4827044/how-to-detect-mathml-tag-support-mfrac-mtable-from-javascript
const hasMathMLSupport = () => {
  const div = document.createElement("div");
  div.innerHTML = '<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>' +
                  '<math><mn>1</mn></math>';
  document.body.appendChild(div);
  const has_mathml = assert_exists(div.firstElementChild?.firstElementChild).getBoundingClientRect().height > assert_exists(div.lastElementChild?.firstElementChild).getBoundingClientRect().height + 1;
  div.remove()
  return has_mathml
}

const display_polynomial_coefficient = (c: number): Node => {
  if (c < 0) {
    return math_el('mrow', {}, math_el('mo', {}, '-'), math_el('mi', {}, (-c).toString()))
  } else {
    return math_el('mi', {}, c.toString())
  }
}

const display_polynomial_term = (c: number, degree: number): Node => {
  assert(c !== 0, 'coefficient === zero so it shouldn\'t be displayed!')
  const dc = display_polynomial_coefficient
  if (degree === 0) {
    return dc(c)
  } else if (degree === 1) {
    const x = math_el('mi', {}, 'x')
    if (c === 1) {
      return x
    } else if (c === -1) {
      return math_el('mrow', {}, math_el('mo', {}, '-'), x)
    } else {
      const m = math_el('mo', {}, '*')
      return math_el('mrow', {}, dc(c), m, x)
    }
  } else {
    // degree ≥ 2.
    const x = math_el('msup', {}, math_el('mi', {}, 'x'), dc(degree))
    if (c === 1) {
      return x
    } else if (c === -1) {
      return math_el('mrow', {}, math_el('mo', {}, '-'), x)
    } else {
      const m = math_el('mo', {}, '*')
      return math_el('mrow', {}, dc(c), m, x)
    }
  }
}

const display_polynomial = (coefficients: number[]): Node => {
  const cs = coefficients
  const final_node = math_el('mrow', {})
  for (const [index, c] of cs.entries()) {
    const degree = cs.length - index - 1
    if (c === 0) {
      continue
    }

    const term = display_polynomial_term(c, degree)
    final_node.appendChild(term)

    if (index !== cs.length - 1) {
      const p = math_el('mo', {}, '+')
      final_node.appendChild(p)
    }
  }
  return final_node
}

const number_to_model_assignment_output = (n: number): ModelAssignmentOutput => {
  if (n < 0) {
    return { tag: 'negative', inner: { tag: 'literal', value: -n } }
  } else {
    return { tag: 'literal', value: n }
  }
}

const model_assignment_display = (ma: ModelAssignmentOutput): Node => {
  const wrap = (ma: ModelAssignmentOutput): Node => {
    if (ma.tag === 'negative') {
      const lp = math_el('mo', {}, '(')
      const rp = math_el('mo', {}, ')')
      return math_el('mrow', {}, lp, sub(ma), rp)
    } else {
      return sub(ma)
    }
  }
  const quad_root_to_display = (a: ModelAssignmentOutput, b: ModelAssignmentOutput, c: ModelAssignmentOutput, index: number): Node => {
    const b_2 = math_el('msup', {}, wrap(b), math_el('mi', {}, '2'))
    const _4ac = math_el('mrow', {},
      math_el('mi', {}, '4'),
      math_el('mo', {}, '*'), wrap(a),
      math_el('mo', {}, '*'), wrap(c))
    const det = math_el('mrow', {}, b_2, math_el('mo', {}, '-'), _4ac)
    const sqrt_det = math_el('msqrt', {}, det)
    assert(index === 1 || index === 2, `Expected root-obj index to equal 1 or 2!\nactual: ${index}`)
    const pm = math_el('mo', {}, index === 1 ? '-' : '+')
    const num = math_el('mrow', {}, math_el('mrow', {}, math_el('mo', {}, '-'), wrap(b)), pm, sqrt_det)
    const den = math_el('mrow', {}, math_el('mi', {}, '2'), math_el('mo', {}, '*'), wrap(a))
    return math_el('mfrac', {}, num, den)
  }
  const sub = (ma: ModelAssignmentOutput): Node => {
    if (ma.tag === 'literal') {
      return math_el('mi', {}, ma.value.toString())
    } else if (ma.tag === 'negative') {
      return math_el('mrow', {}, math_el('mo', {}, '-'), sub(ma.inner))
    } else if (ma.tag === 'rational') {
      return math_el('mfrac', {}, sub(ma.numerator), sub(ma.denominator))
    } else if (ma.tag === 'root-obj') {
      return quad_root_to_display(ma.a, ma.b, ma.c, ma.index)
    } else if (ma.tag === 'unknown') {
      return math_el('mtext', {}, s_to_string(ma.s))
      // return math_el('mtext', {}, 'something!')
    } else if (ma.tag === 'generic-root-obj') {
      if (ma.degree === 2) {
        return quad_root_to_display(
          number_to_model_assignment_output(ma.coefficients[0]),
          number_to_model_assignment_output(ma.coefficients[1]),
          number_to_model_assignment_output(ma.coefficients[2]),
          ma.index)
      }
      // return sub({ tag: 'unknown', s: ['root-obj', poly_s(ma.coefficients), ma.index.toString()] })
      // return math_el('mtext', {}, model_assignment_output_to_string(ma))
      return math_el('mrow', {}, math_el('mtext', {}, `Root #${ma.index} of `), math_el('mpadded', { lspace: '0.2em' }, display_polynomial(ma.coefficients)))
    } else {
      return fallthrough('model_assignment_to_display', ma)
    }
  }

  return math_el('math', {}, sub(ma))
}

// Should be the same as the model display, just without the final column.
const truth_table_display = (tt: TruthTable): HTMLElement => {
  // One column per sentence-letter
  // Header has the form "A1 | A2 | ... | An | a_i | Assignment"

  // const model_assignments = await model_to_assignments(ctx, z3_model)
  const body = el('tbody', {})
  const head_row = el('tr', {})
  const head = el('thead', {}, head_row)
  for (const l of tt.letters()) {
    head_row.appendChild(el('th', {}, letter_string(l)))
  }
  head_row.appendChild(el('th', { class: 'dv' }))
  head_row.appendChild(el('th', {}, state_id('i')))
  head_row.appendChild(el('th', { class: 'dv' }))

  for (const state_index of tt.state_indices()) {  // rows
    const row = el('tr', {})
    for (const l of tt.letters()) {
      const letter_value = tt.letter_value_from_index(l, state_index)
      const value_string = letter_value ? '⊤' : '⊥'
      row.appendChild(el('td', {}, value_string))
    }
    row.appendChild(el('td', { class: 'dv' }))
    row.appendChild(el('td', {}, state_id(state_index)))
    row.appendChild(tel(TestId.state_row.state(state_index), 'td', { class: 'dv' }))
    body.appendChild(row)
  }
  const e = el('table', {},
    head,
    body)
  return e
}

const model_display = (tt: TruthTable, model_assignments: Record<number, ModelAssignmentOutput>): HTMLElement => {
  // One column per sentence-letter
  // Header has the form "A1 | A2 | ... | An | a_i | Assignment"

  const body = el('tbody', {})
  const head_row = el('tr', {})
  const head = el('thead', {}, head_row)
  for (const l of tt.letters()) {
    head_row.appendChild(el('th', {}, letter_string(l)))
  }
  head_row.appendChild(el('th', { class: 'dv' }))
  head_row.appendChild(el('th', {}, state_id('i')))
  head_row.appendChild(el('th', { class: 'dv' }))
  head_row.appendChild(el('th', {}, 'Assignment'))

  for (const [i, ma] of Object.entries(model_assignments)) {  // rows
    const state_index = parseInt(i)
    const assignment_html = model_assignment_display(ma)
    const row = el('tr', {})
    for (const l of tt.letters()) {
      const letter_value = tt.letter_value_from_index(l, state_index)  // Scary parseInt!
      const value_string = letter_value ? '⊤' : '⊥'
      row.appendChild(el('td', {}, value_string))
    }
    row.appendChild(el('td', { class: 'dv' }))
    row.appendChild(el('td', {}, state_id(state_index)))
    row.appendChild(tel(TestId.state_row.state(state_index), 'td', { class: 'dv' }))
    row.appendChild(tel(TestId.state_row.value(state_index), 'td', {}, assignment_html))
    body.appendChild(row)
  }
  const e = tel(TestId.model_table, 'table', {},
    head,
    body)
  return e
}

type ModelFinderState2 =
  | { tag: 'waiting' }
  | { tag: 'looking', truth_table: TruthTable, abort_controller: AbortController }
  | { tag: 'finished', truth_table: TruthTable, solver_output: PrSATResult }
  // | { tag: 'invalidated', last: { truth_table: TruthTable } }
  | { tag: 'invalidated', last: ModelFinderState2 }
  | { tag: 'exception', message: string }

type ModelFinderDisplay = {
  element: HTMLElement
  state: rEditable<ModelFinderState2>
  // start_search: (ctx: Context, constraints: Constraint[], is_regular: boolean) => Promise<void>
  start_search_solver: (solver: WrappedSolver, constraints: Constraint[], is_regular: boolean) => Promise<void>
  invalidate: () => void
}

const display_constraint_or_real_expr = (e: ConstraintOrRealExpr, wrap_in_math_element: boolean): Element => {
  if (e.tag === 'constraint') {
    return constraint_to_html(e.constraint, wrap_in_math_element)
  } else {
    return real_expr_to_html(e.real_expr, wrap_in_math_element)
  }
}

type ModelEvaluator = {
  element: HTMLElement
  refresh: () => void
}

const fancy_evaluator_result_to_display = (output: FancyEvaluatorOutput): Node => {
  if (output.tag === 'result') {
    return model_assignment_display(output.result)
  } else if (output.tag === 'bool-result') {
    return math_el('mtext', {}, output.result ? '⊤' : '⊥')
  } else if (output.tag === 'undeclared-vars') {
    const fv_str = [...output.variables.real, ...output.variables.sentence].map((v) => {
      if (typeof v === 'string') {
        return v
      } else {
        return letter_string(v)
      }
    }).join(', ')
    return math_el('mtext', { class: 'error' }, `Undeclared variables: ${fv_str}`)
  } else if (output.tag === 'div0') {
    return math_el('mtext', { class: 'error' }, Constants.DIV0)
  } else {
    return fallthrough('fancy_evaluator_result_to_display', output)
  }
}

const model_evaluators = (
  // z3_state_box: Editable<Z3ContextState>,
  state_box: Editable<ModelFinderState2>,
  model_assignments: rEditable<{ truth_table: TruthTable, values: Record<number, ModelAssignmentOutput> } | undefined>,
): ModelEvaluator => {
  const display_constraint_or_real_expr_with_evaluation = async (e: ConstraintOrRealExpr): Promise<Element> => {
    const d = display_constraint_or_real_expr(e, false)
    const assignments = model_assignments.get()
    if (assignments === undefined) {
      return d
    } else {
      const state = state_box.get()
      const [tt, solve_result]: [TruthTable | undefined, WrappedSolverResult] =
        state.tag === 'finished' ? [state.truth_table, state.solver_output.solver_output]
        : state.tag === 'invalidated' && state.last.tag === 'finished' ? [state.last.truth_table, state.last.solver_output.solver_output]
        : [undefined, { status: 'unknown' }]
      if (solve_result.status !== 'sat' || tt === undefined) {
        const result_html = math_el('mtext', { class: 'error' }, Constants.NO_MODEL)
        return math_el('math', {},
          d,
          math_el('mo', { class: 'yields' }, '⟾'),
          result_html)
      }

      const result = await solve_result.evaluate(tt, e)
      const result_html = fancy_evaluator_result_to_display(result)
      return math_el('math', {},
        d,
        math_el('mo', { class: 'yields' }, '⟾'),
        result_html)
    }
  }

  const test_ids = TestId.generic_multi_input('eval')
  const eval_block = new InputBlockLogic<ConstraintOrRealExpr, SplitInput>(
    parse_constraint_or_real_expr,
    (logic) => split_input(logic, display_constraint_or_real_expr_with_evaluation, Constants.EVALUATOR_INPUT_PLACEHOLDER, test_ids.split))
  const mi = generic_input_block(eval_block, Constants.BATCH_EVALUATOR_INPUT_PLACEHOLDER, test_ids)

  const refresh = async () => {
    for (const input of eval_block.get_inputs()) {
      await input.text.set(input.text.get())
    }
  }

  const element = el('div', { class: 'model-evaluators' },
    el('div', { style: 'margin-bottom: 0.4em;' }, 'Evaluate model'),
    mi.element,
  )
  return { element, refresh  }
}

const seconds_to_hms = (total_seconds: number): { h: number, m: number, s: number } => {
  const ts = Math.floor(total_seconds)

  let leftover = ts
  const h = Math.floor(leftover / 3600)
  leftover -= h * 3600
  const m = Math.floor(leftover / 60)
  leftover -= m * 60
  const s = leftover

  return { h, m, s }
}

const seconds_to_time_string = (total_seconds: number) => {
  const { h: hours, m: minutes, s: seconds } = seconds_to_hms(total_seconds)
  let split_str: string[] = []

  if (hours > 0) {
    split_str.push(`${hours}h`)
  }
  if (minutes > 0) {
    split_str.push(`${minutes}m`)
  }
  if (seconds > 0) {
    split_str.push(`${seconds}s`)
  }

  return split_str.join(', ')
}

const timeout = (timeout_ms: Editable<number>) => {
  const MIN_HRS = 0
  const MAX_HRS = 2
  const MIN_MNS = 0
  const MAX_MNS = 59
  const MIN_SCS = 0
  const MAX_SCS = 59

  const { h, m, s } = seconds_to_hms(timeout_ms.get() / 1000)
  const DEF_HRS = h
  const DEF_MNS = m
  const DEF_SCS = s

  const hi = tel(TestId.timeout.hours, 'input', { style: 'margin-right: 0.5ch; margin-bottom: 0.1ch;', type: 'number', min: MIN_HRS.toString(), max: MAX_HRS.toString(), value: DEF_HRS.toString() }) as HTMLInputElement
  const mi = tel(TestId.timeout.minutes, 'input', { style: 'margin-right: 0.5ch; margin-bottom: 0.1ch', type: 'number', min: MIN_MNS.toString(), max: MAX_MNS.toString(), value: DEF_MNS.toString() }) as HTMLInputElement
  const si = tel(TestId.timeout.seconds, 'input', { style: 'margin-right: 0.5ch;', type: 'number', min: MIN_SCS.toString(), max: MAX_SCS.toString(), value: DEF_SCS.toString() }) as HTMLInputElement

  const set_timeout_ms = () => {
    const h = parseInt(hi.value)
    const m = parseInt(mi.value)
    const s = parseInt(si.value)
    const ms = s * 1000 + m * 60 * 1000 + h * 60 * 60 * 1000
    timeout_ms.set(ms)
  }

  // we're overriding the initial setting because why not?
  set_timeout_ms()

  hi.onchange = () => {
    const parsed = parseInt(hi.value)
    const value = Math.min(parsed, MAX_HRS)
    hi.value = value.toString()
    set_timeout_ms()
  }

  mi.onchange = () => {
    const parsed = parseInt(mi.value)
    const value = Math.min(parsed, MAX_MNS)
    mi.value = value.toString()
    set_timeout_ms()
  }

  si.onchange = () => {
    const parsed = parseInt(si.value)
    const value = Math.min(parsed, MAX_SCS)
    si.value = value.toString()
    set_timeout_ms()
  }

  return tel(TestId.timeout.id, 'div', {},
    el('label', { style: 'display: block;' }, hi, 'hour(s)'),
    el('label', { style: 'display: block;' }, mi, 'minute(s)'),
    el('label', { style: 'display: block;' }, si, 'second(s)'),
  )
}

const timeout_countdown = (timeout_seconds: Editable<number>, at_zero: () => void): { cancel: () => void } => {
  assert(timeout_seconds.get() >= 0, 'Start of timeout countdown is < 0 for some reason!')
  if (timeout_seconds.get() <= 0) {
    at_zero()
  }

  const cancel = () => {
    clearInterval(interval)
  }

  const interval = setInterval(() => {
    // console.log('THIS INTERVAL IS HITTING', timeout_seconds.get())
    if (timeout_seconds.get() <= 0) {
      at_zero()
      cancel()
    } else {
      timeout_seconds.set(timeout_seconds.get() - 1)
    }
  }, 1000)

  return { cancel }
}

const timeout_element = (timeout_seconds: Editable<number>): { element: HTMLElement, start: (timeout: number, at_zero: () => void) => void, cancel: () => void } => {
  const e = el('span', {}, seconds_to_time_string(timeout_seconds.get()))
  timeout_seconds.watch((seconds_left) => {
    e.innerHTML = ''
    e.append(seconds_to_time_string(seconds_left))
  })

  let countdown: { cancel: () => void } | undefined = undefined

  return {
    element: e,
    start: (timeout: number, at_zero: () => void) => {
      timeout_seconds.set(timeout)
      countdown = timeout_countdown(timeout_seconds, () => {
        at_zero()
      })
    },
    cancel: () => {
      countdown?.cancel()
    },
  }
}

const model_finder_display = (constraint_block: InputBlockLogic<Constraint, SplitInput>, machine: SolverStateMachine): ModelFinderDisplay => {
  // const state = new Editable<ModelFinderState>({ tag: 'waiting' })
  const state2 = new Editable<ModelFinderState2>({ tag: 'waiting' })
  const model_container = el('div', { class: 'model-container' })
  const state_display = tel(TestId.state_display_id, 'div', {})
  const status_container = el('div', { style: 'margin-top: 0.4em;' }, state_display)
  const left_side = el('div', { style: 'border-right: solid gainsboro; padding-right: 1em;' },
    model_container,
  )
  // const z3_state = new Editable<Z3ContextState>({ tag: 'loading' })
  const z3_state2 = new Editable<Z3SolverState>({ tag: 'loading' })
  // const model_assignments = new Editable<{ truth_table: TruthTable, model: Model, values: Record<number, ModelAssignmentOutput> } | undefined>(undefined)
  const model_assignments2 = new Editable<{ truth_table: TruthTable, values: Record<number, ModelAssignmentOutput> } | undefined>(undefined)
  // const evaluators = model_evaluators(z3_state, model_assignments)
  const evaluators = model_evaluators(state2, model_assignments2)
  const right_side = el('div', {},
    // evaluators.element,  // Will be added in the state watcher.
  )
  const split_view = el('div', { style: 'display: flex; margin-top: 0.4em;' },
    left_side,
    right_side,
  )
  const constraints_view = el('div', { style: 'margin-top: 0.4em;' })

  const generate_button = tel(TestId.find_model, 'input', { type: 'button', value: Constants.FIND_MODEL_BUTTON_LABEL, class: 'generate' }) as HTMLButtonElement
  const cancel_button = tel(TestId.cancel_id, 'input', { type: 'button', value: Constants.CANCEL_BUTTON_LABEL, style: 'margin-top: 0.4em;' }) as HTMLButtonElement
  const z3_status_container = tel(TestId.z3_status, 'div', { style: 'margin-bottom: 0.4em;' })
  const is_regular = new Editable(false)
  const regular_toggle = tel(TestId.regular_toggle, 'input', { type: 'checkbox', style: 'margin-left: 0.4em;' }, 'Regular') as HTMLInputElement
  const timeout_ms = new Editable(Constants.DEFAULT_SOLVE_TIMEOUT_MS)
  const timeout_input = timeout(timeout_ms)
  timeout_ms.watch((ms) => { console.log('timeout set to:', ms) })
  const generate_line = el('div', { style: 'display: flex;' },
    generate_button,
    el('div', { style: 'display: flex; flex-direction: column; margin-left: 0.4em;' },
      el('label', {},
        'Regular:',
        regular_toggle,
      ),
      el('label', { style: 'display: flex;' },
        el('span', { style: 'margin-right: 1ch;' }, 'Timeout:'),
        timeout_input,
      ),
    ),
  )
  
  const set_all_constraints = (all_constraints: Constraint[] | undefined) => {
    invalidate()
    if (all_constraints === undefined) {
      generate_button.disabled = true
    } else {
      generate_button.disabled = false
    }
  }

  is_regular.watch(() => {
    invalidate()
  })

  constraint_block.on_ready((all_constraints) => {
    set_all_constraints(all_constraints)
  })
  regular_toggle.addEventListener('change', () => {
    is_regular.set(regular_toggle.checked)
  })

  const init_z3_after_first_time_boo = async () => {
    const state = z3_state2.get()
    if (state.tag !== 'ready') {
      throw new Error('Function should only be called after z3 has been properly loaded at least once.')
    }

    try {
      z3_state2.set({ tag: 'loading' })
      const z3_interface = await init_z3()
      await sleep(1000)  // Oh no why am I sleeping 1000??
      z3_state2.set({ tag: 'ready', solver: state.solver })
      return z3_interface
    } catch (e: any) {
      z3_state2.set({ tag: 'error', message: e.message })
      return undefined
    }
  }

  init_z3()
    .then((z3_interface) => {
      z3_state2.set({ tag: 'ready', solver: new WrappedSolver(z3_interface, init_z3_after_first_time_boo) })
    })
    .catch((error) => {
      z3_state2.set({ tag: 'error', message: error.message })
    })
  
  // gross
  let already_initialized = false
  
  // z3_state.watch((state) => {
  z3_state2.watch((state) => {
    console.log('z3_state change', z3_state2.get())
    z3_status_container.innerHTML = ''
    if (state.tag === 'loading') {
      z3_status_container.append('Loading Z3...')
      generate_button.disabled = true
    } else if (state.tag === 'ready') {
      // z3_is_ready(state.ctx)
      if (!already_initialized) {
        already_initialized = true
        z3_is_ready_2(state.solver)
      }
      set_all_constraints(constraint_block.get_output())
    } else if (state.tag === 'error') {
      z3_status_container.append(state.message)
      z3_status_container.style.color = 'red'
      if (state.message === 'Out of memory') {
        z3_status_container.append('.  Try closing and re-opening the tab or window.')
      }
      generate_button.disabled = true
    } else {
      fallthrough('model_finder_display.z3_state2.watch', state)
    }
  }).call()

  // const z3_is_ready = (ctx: Context) => {
  //   generate_button.addEventListener('click', async () => {
  //     const constraints = assert_exists(constraint_block.get_output(), 'Generate button clicked but not all constraints ready!')
  //     await start_search(ctx, constraints, is_regular.get())
  //   })
  // }

  const cancel = (abort_controller: AbortController) => {
    console.log('cancelling!')
    state_display.innerHTML = ''
    state_display.append(Constants.CANCELLING)
    abort_controller.abort()
  }

  const z3_is_ready_2 = (solver: WrappedSolver) => {
    generate_button.addEventListener('click', async () => {
      assert(state2.get().tag !== 'looking', 'Trying to generate another model while looking for stuff!')
      const constraints = assert_exists(constraint_block.get_output(), 'Generate button clicked but not all constraints ready!')
      await start_search_solver(solver, constraints, is_regular.get())
    })
    cancel_button.onclick = () => {
      const state = state2.get()
      if (state.tag !== 'looking') {
        throw new Error(`Trying to cancel while not looking for a model!\nstate: ${JSON.stringify(state)}`)
      }
      cancel(state.abort_controller)
    }
  }

  // hack to get timeouts working BOO.
  (async () => {
    const old_constraints_text = localStorage.getItem('constraints')
    if (old_constraints_text !== null) {
      console.log('Setting from old constraints text')
      const lines = old_constraints_text.split('\n')
      await constraint_block.set_fields(lines)
      localStorage.removeItem('constraints')
    }
  })().catch(() => {})

  const cancel_fallback = async (): Promise<undefined> => {
    console.log('cancel fallback')
    localStorage.setItem('constraints', constraint_block.get_fields().join('\n'))
    window.location.reload()  // boooooooooooooooo!
  }

  const start_search_solver = async (solver: WrappedSolver, constraints: Constraint[], is_regular: boolean): Promise<void> => {
    const truth_table = new TruthTable(variables_in_constraints(constraints))
    // state.set({ tag: 'looking', truth_table })
    const abort_controller = new AbortController()
    state2.set({ tag: 'looking', truth_table, abort_controller })
    model_container.innerHTML = ''
    try {
      const tt_display = truth_table_display(truth_table)
      model_container.appendChild(tt_display)
      const result = await pr_sat_wrapped(solver, truth_table, constraints, { regular: is_regular, abort_signal: abort_controller.signal, cancel_fallback })
      state2.set({ tag: 'finished', truth_table, solver_output: result })
    }
    catch (e: any) {
      state2.set({ tag: 'exception', message: e.message })
      status_container.appendChild(el('div', { style: 'color: red;' },
        tel(TestId.exception_id, 'div', {}, 'Exception!'),
        e.message))
      console.error(e.stack)
    }
  }

  const invalidate = (): void => {
    const last_state = state2.get()
    if (last_state.tag === 'invalidated') {
      // do nothing!
    } else if (last_state.tag === 'finished') {
      state2.set({ tag: 'invalidated', last: last_state })
    } else {
      state2.set({ tag: 'waiting' })
    }
  }

  const model_part = el('div', {},
    status_container,
    split_view,
    constraints_view,
  )

  const element = el('div', { class: 'model-finder' },
    z3_status_container,
    generate_line,
    cancel_button,
    model_part,
  )

  const timeout_seconds = new Editable(0)
  const { element: timeout_countdown_element, start: start_countdown, cancel: cancel_countdown } = timeout_element(timeout_seconds)

  state2.watch((state, last_state) => {
    console.log('model_finder state change', state)

    // Logic
    if (state.tag === 'finished') {
      if (state.solver_output.solver_output.status === 'sat') {
        model_assignments2.set({ truth_table: state.truth_table, values: state.solver_output.solver_output.state_assignments })
        evaluators.refresh()
      } else if (state.solver_output.solver_output.status === 'unsat') {
        model_assignments2.set(undefined)
      }
    } else if (last_state?.tag !== 'looking' && state.tag === 'looking') {
      start_countdown(timeout_ms.get() / 1000, () => { cancel(state.abort_controller) })
      evaluators.refresh()
    }
    if (last_state?.tag === 'looking' && state.tag !== 'looking') {
      cancel_countdown()
    }
    
    model_part.classList.remove('invalidated')
    cancel_button.disabled = true
    if (state.tag === 'waiting') {
      right_side.innerHTML = ''
      state_display.innerHTML = ''
      state_display.append('No model to display!')
      model_part.classList.add('invalidated')
      model_container.innerHTML = ''
      constraints_view.innerHTML = ''
      generate_button.disabled = false
    } else if (state.tag === 'looking') {
      state_display.innerHTML = ''
      state_display.append(Constants.SEARCH)
      state_display.append(' ')
      state_display.appendChild(timeout_countdown_element)
      generate_button.disabled = true
      cancel_button.disabled = false
    } else if (state.tag === 'finished') {
      generate_button.disabled = false

      if (state.solver_output.solver_output.status !== 'exception') {
        const result = state.solver_output
        constraints_view.innerHTML = ''

        const save_translated_constraints_button = el('input', { type: 'button', value: 'Save Translated Constraints' })
        save_translated_constraints_button.onclick = () =>
          download(result.optimized.constraints.map(constraint_to_string).join('\n'), 'translated.txt', 'text/plain')

        const save_smtlib_button = el('input', { type: 'button', value: 'Save SMTLIB Input', style: 'margin-left: 0.4em;' })
        save_smtlib_button.onclick = () =>
          download(result.optimized.smtlib.join('\n'), 'smtlib.txt', 'text/plain')

        const result_save_button_bar = el('span', {}, save_translated_constraints_button, save_smtlib_button)
        constraints_view.appendChild(result_save_button_bar)

        for (const constraint of result.optimized.constraints) {
          const e = constraint_to_html(constraint, true)
          constraints_view.appendChild(el('div', { style: 'margin-top: 0.4em;' }, e))
        }
      }

      if (state.solver_output.solver_output.status === 'sat') {
        state_display.innerHTML = ''
        state_display.append(Constants.SAT)
        const model_html = model_display(state.truth_table, state.solver_output.solver_output.state_assignments)
        model_container.innerHTML = ''
        model_container.appendChild(model_html)
        right_side.appendChild(evaluators.element)
      } else if (state.solver_output.solver_output.status === 'unsat') {
        state_display.innerHTML = ''
        state_display.append(Constants.UNSAT)
        right_side.innerHTML = ''
      } else if (state.solver_output.solver_output.status === 'unknown') {
        state_display.innerHTML = ''
        state_display.append(Constants.UNKNOWN)
      } else if (state.solver_output.solver_output.status === 'cancelled') {
        state_display.innerHTML = ''
        state_display.append(Constants.CANCELLED)
      } else if (state.solver_output.solver_output.status === 'exception') {
        state_display.innerHTML = ''
        state_display.appendChild(el('span', {}, `Exception! ${state.solver_output.solver_output.message}`))
      } else {
        fallthrough('model_finder_display.state2.watch', state.solver_output.solver_output)
      }
    } else if (state.tag === 'invalidated') {
      state_display.innerHTML = ''
      state_display.append('No up-to-date model to display')
      model_part.classList.add('invalidated')
    } else if (state.tag === 'exception') {
    } else {
      fallthrough('model_finder_display.state.watch', state)
    }
  })

  return { element, state: state2, start_search_solver, invalidate }
}

type Z3SolverState =
  | { tag: 'loading' }
  | { tag: 'ready', solver: WrappedSolver }
  | { tag: 'error', message: string }

const main = (): HTMLElement => {
  const solver = new BaseSolver()
  const machine = new SolverStateMachine(solver)

  const test_ids = TestId.generic_multi_input('constraints')
  const constraint_block = new InputBlockLogic<Constraint, SplitInput>(
    parse_constraint,
    (logic) => split_input(logic, async (c) => constraint_to_html(c, true), Constants.CONSTRAINT_INPUT_PLACEHOLDER, test_ids.split))

  const mi = generic_input_block(constraint_block, Constants.BATCH_CONSTRAINT_INPUT_PLACEHOLDER, test_ids)
  const model_finder = model_finder_display(constraint_block, machine)

  model_finder.state.watch((state, last_state) => {
    if (last_state?.tag !== 'looking' && state.tag === 'looking') {
      mi.set_disabled(true)
    } else if (last_state?.tag === 'looking' && state.tag !== 'looking') {
      mi.set_disabled(false)
    }
  })

  const global_error_display = el('div', { class: 'global-error' })
  global_error_display.style.display = 'none'
  const show_error = (message: string) => {
    global_error_display.innerHTML = ''
    global_error_display.appendChild(el('div', { class: 'error' }, 'Unexpected Exception!'))
    global_error_display.appendChild(el('div', { class: 'error' }, 'Email a bug report to ', el('a', { href: 'mailto:adjorlolo.k@northeastern.edu' }, 'Koissi Adjorlolo'), ' with a description of what you were doing when this error message popped up along with a screenshot of this page.'))
    global_error_display.appendChild(el('div', { class:' error' }, 'You can still use the app, but things might not work as expected.'))
    global_error_display.appendChild(el('div', { class:' error' }, message))
    global_error_display.style.display = 'block'
  }

  window.onunhandledrejection = (event) => {
    show_error(JSON.stringify(event.reason))
  }

  window.onerror = (event) => {
    if (typeof event === 'string') {
      show_error(event)
    } else {
      show_error(JSON.stringify(event))
    }
  }

  return el('div', {},
    el('div', { class: 'header' },
      el('div', { style: 'font-weight: bold;' }, 'PrSAT 3.0b: The Probability Table Generator (Beta)'),
      el('br', {}),
      el('div', {}, 'PrSAT 3.0 is an open source, ASCII/web based probability table generator.'),
      el('div', {}, 'It runs on any modern browser, and requires no additional software.'),
      el('div', {}, 'It takes (arbitrary) sets of statements in probability calculus as input (in ASCII format).'),
      el('div', {}, 'If the set is satisfiable, it will return a probability distribution (in the form of a probability table).'),
      el('div', {}, 'If not, it will return "unsatisfiable."'),
      el('br', {}),
      el('div', {}, 'As the software is in Beta it is incomplete and there WILL be bugs.'),
      el('div', {},
        'Email descriptions of issues you\'ve encountered or features you\'d like to see to ',
        el('a', { href: 'mailto:adjorlolo.k@northeastern.edu' }, 'Koissi Adjorlolo'),
        '.'),
      el('br', {}),
      el('div', {}, el('a', { href: 'https://youtu.be/IGHjYUI0CL4' }, 'Here is a brief video demo of the software'), '.'),
    ),
    global_error_display,
    mi.element,
    model_finder.element,
  )
}

if (!hasMathMLSupport()) {
  alert('No mathML support :(')
  throw new Error('No mathML support :(')
}

root.appendChild(main())
