import { Context, Model } from "z3-solver";
import { Editable, EditableDLL, rEditable, WatchGroup } from './editable';
import { el, math_el } from "./el";
import { assert, assert_exists, assert_result, Res } from "./utils";
import { debounce } from "./debounce";
import { parse_constraint } from "./parser";
import { constraint_to_string, parse_s, possible_constraint_connectives, possible_sentence_connectives, sentence_to_string, TruthTable } from "./pr_sat";
import { init_z3, pr_sat } from "./z3_integration";
import { match_s, S, spv, clause, s_to_string } from "./s";

import './style.css'
import { PrSat } from "./types";

const DEFAULT_DEBOUNCE_MS = 150
const CONSTRAINT_INPUT_PLACEHOLDER = 'Enter constraint'
const INFO_MESSAGE_EMPTY = 'ⓘ How?'
const INFO_MESSAGE_ERROR = 'ⓘ Error!'
const INFO_MESSAGE_OKAY = 'ⓘ'

const root = assert_exists(document.getElementById('app'), 'Root element with id \'#app\' doesn\'t exist!')

type Constraint = PrSat['Constraint']
type RealExpr = PrSat['RealExpr']
type Sentence = PrSat['Sentence']

// type Readable<T> = { get: () => T }

type SingleInputCallbacks = {
  siblings: EditableDLL<SingleInput>
  set_is_ready: (si: SingleInput, is_ready: boolean) => void
  make_newline: (si: SingleInput) => void
  remove: (si: SingleInput) => void
  focus_first: () => void
  focus_next: (si: SingleInput) => void
  focus_prev: (si: SingleInput) => void
}

type SingleInput = {
  full: HTMLElement
  input: HTMLInputElement
  watch_group: WatchGroup<unknown>
  constraint: rEditable<Constraint | undefined | { error: string }>
}

const single_input_callbacks_after = (siblings: EditableDLL<SingleInput>): [Editable<boolean>, SingleInputCallbacks] => {
  const ready_set = new Set<SingleInput>()
  const all_are_ready = new Editable(false)
  const recheck_ready = () => {
    if (ready_set.size === siblings.size()) {
      all_are_ready.set(true)
    } else if (all_are_ready.get() === true && ready_set.size < siblings.size()) {
      all_are_ready.set(false)
    }
  }
  const self: SingleInputCallbacks = {
    siblings,
    set_is_ready: (si, is_ready) => {
      if (is_ready) {
        ready_set.add(si)
      } else {
        ready_set.delete(si)
      }
      recheck_ready()
    },
    make_newline: (si: SingleInput) => {
      const new_input = single_input(CONSTRAINT_INPUT_PLACEHOLDER, self)
      siblings.insert_after(si, new_input)
      new_input.input.focus()
      recheck_ready()
    },
    remove: (si: SingleInput) => {
      if (siblings.size() === 1) {
        // Don't do it!
      } else {
        const prev_sibling = siblings.get_previous(si)
        if (prev_sibling !== undefined) {
          prev_sibling?.input.focus()
          prev_sibling?.input.setSelectionRange(0, 0)
        } else {
          const next_sibling = siblings.get_next(si)
          next_sibling?.input.focus()
          next_sibling?.input.setSelectionRange(0, 0)
          console.log('next!')
        }
        siblings.remove(si)
        si.watch_group.unwatch()
        ready_set.delete(si)
        recheck_ready()
      }
    },
    focus_first: () => {
      siblings.at(0)?.full.focus()
    },
    focus_next: (si: SingleInput) => {
      const next_sibling = siblings.get_next(si)
      next_sibling?.input.focus()
    },
    focus_prev: (si: SingleInput) => {
      const prev_sibling = siblings.get_previous(si)
      prev_sibling?.input.focus()
    },
  }
  return [all_are_ready, self]
}

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

const constraint_to_html = (constraint: Constraint): MathMLElement => {
  const re2h = (expr: RealExpr): MathMLElement => real_expr_to_html(expr)
  const wrap = (constraint: Constraint, exclude: Constraint['tag'][]): MathMLElement => {
    if (!exclude.includes(constraint.tag)) {
      const lp = math_el('mo', {}, '(')
      const rp = math_el('mo', {}, ')')
      return math_el('mrow', {}, lp, sub(constraint), rp)
    } else {
      return sub(constraint)
    }
  }
  const sub = (constraint: Constraint): MathMLElement => {
    const connectives = assert_exists(possible_constraint_connectives[constraint.tag])
    const c = assert_exists(connectives[0])
    const op = math_el('mo', {}, c)
    if (constraint.tag === 'equal') {
      return math_el('mrow', {}, re2h(constraint.left), op, re2h(constraint.right))
    } else if (constraint.tag === 'not_equal') {
      return math_el('mrow', {}, re2h(constraint.left), op, re2h(constraint.right))
    } else if (constraint.tag === 'less_than') {
      return math_el('mrow', {}, re2h(constraint.left), op, re2h(constraint.right))
    } else if (constraint.tag === 'less_than_or_equal') {
      return math_el('mrow', {}, re2h(constraint.left), op, re2h(constraint.right))
    } else if (constraint.tag === 'greater_than') {
      return math_el('mrow', {}, re2h(constraint.left), op, re2h(constraint.right))
    } else if (constraint.tag === 'greater_than_or_equal') {
      return math_el('mrow', {}, re2h(constraint.left), op, re2h(constraint.right))
    } else if (constraint.tag === 'negation') {
      return math_el('mrow', {}, op, wrap(constraint.constraint, ['negation']))
    } else {
      const no_wrap_tags: Constraint['tag'][] = ['negation', 'equal', 'not_equal', 'less_than', 'less_than_or_equal', 'greater_than', 'greater_than_or_equal']
      return math_el('mrow', {}, wrap(constraint.left, no_wrap_tags), op, wrap(constraint.right, [...no_wrap_tags, constraint.tag]))
    }
  }

  return math_el('math', {}, sub(constraint))
}

const real_expr_to_html = (expr: RealExpr): MathMLElement => {
  const sub = (expr: RealExpr): MathMLElement => real_expr_to_html(expr)
  const wrap = (expr: RealExpr, exclude: RealExpr['tag'][]): MathMLElement => {
    if (!exclude.includes(expr.tag)) {
      const lp = math_el('mo', {}, '(')
      const rp = math_el('mo', {}, ')')
      return math_el('mrow', {}, lp, sub(expr), rp)
    } else {
      return sub(expr)
    }
  }
  const s2h = sentence_to_html
  if (expr.tag === 'literal') {
    return math_el('mi', {}, expr.value.toString())
  } else if (expr.tag === 'variable') {
    return math_el('mi', {}, expr.id)
  } else if (expr.tag === 'probability') {
    const lead = math_el('mo', { lspace: '0', rspace: '0' }, 'Pr')
    const lp = math_el('mo', {}, '(')
    const rp = math_el('mo', {}, ')')
    return math_el('mrow', {}, lead, lp, s2h(expr.arg), rp)
  } else if (expr.tag === 'given_probability') {
    const lead = math_el('mo', { lspace: '0', rspace: '0' }, 'Pr')
    const lp = math_el('mo', {}, '(')
    const mid = math_el('mo', {}, '|')
    const rp = math_el('mo', {}, ')')
    return math_el('mrow', {}, lead, lp, s2h(expr.arg), mid, s2h(expr.given), rp)
  } else if (expr.tag === 'state_variable_sum') {
    const e = math_el('mrow', {})
    for (const [index, si] of expr.indices.entries()) {
      const summand = state_id(si)
      e.appendChild(summand)
      if (index < expr.indices.length - 1) {
        const op = math_el('mo', {}, '+')
        e.appendChild(op)
      }
    }
    return e
  } else if (expr.tag === 'negative') {
    const op = math_el('mo', {}, '-')
    return math_el('mrow', {}, op, wrap(expr.expr, ['literal', 'probability', 'given_probability', 'variable']))
  } else if (expr.tag === 'power') {
    return math_el('msup', {}, wrap(expr.base, ['literal', 'probability', 'given_probability', 'negative', 'variable']), sub(expr.exponent))
  } else if (expr.tag === 'plus') {
    const op = math_el('mo', {}, '+')
    return math_el('mrow', {}, wrap(expr.left, ['literal', 'variable', 'probability', 'given_probability', 'negative', 'plus', 'minus', 'multiply', 'divide', 'power']), op, wrap(expr.right, ['variable', 'literal', 'probability', 'given_probability', 'negative', 'multiply', 'divide', 'power']))
  } else if (expr.tag === 'minus') {
    const op = math_el('mo', {}, '-')
    return math_el('mrow', {}, wrap(expr.left, ['variable', 'literal', 'probability', 'given_probability', 'negative', 'plus', 'minus', 'multiply', 'divide', 'power']), op, wrap(expr.right, ['variable', 'literal', 'probability', 'given_probability', 'negative', 'multiply', 'divide', 'power']))
  } else if (expr.tag === 'multiply') {
    const op = math_el('mo', {}, '*')
    return math_el('mrow', {}, wrap(expr.left, ['variable', 'literal', 'probability', 'given_probability', 'negative', 'multiply', 'divide', 'power']), op, wrap(expr.right, ['variable', 'literal', 'probability', 'given_probability', 'negative', 'power', 'divide']))
  } else if (expr.tag === 'divide') {
    const n = math_el('mrow', {}, wrap(expr.numerator, ['state_variable_sum', 'variable', 'literal', 'probability', 'given_probability', 'negative', 'plus', 'minus', 'multiply', 'power']))
    const d = math_el('mrow', {}, wrap(expr.denominator, ['state_variable_sum', 'variable', 'literal', 'probability', 'given_probability', 'negative', 'plus', 'minus', 'multiply', 'power']))
    return math_el('mfrac', {}, n, d)
  } else {
    throw new Error('real_expr_to_html fallthrough')
  }
}

const sentence_to_html = (s: Sentence): MathMLElement => {
  const sub = (s: Sentence) => sentence_to_html(s)
  const wrap = (s: Sentence, exclude: Sentence['tag'][]) => {
    if (!exclude.includes(s.tag)) {
      const lp = math_el('mo', {}, '(')
      const rp = math_el('mo', {}, ')')
      return math_el('mrow', {}, lp, sub(s), rp)
    } else {
      return sub(s)
    }
  }

  if (s.tag === 'value') {
    const text = s.value ? '⊤' : '⊥'
    return math_el('mi', {}, text)
  } else if (s.tag === 'letter') {
    return math_el('mi', {}, s.id)
  } else if (s.tag === 'negation') {
    const op = math_el('mo', {}, '~')
    return math_el('mrow', {}, op, wrap(s.sentence, ['negation', 'letter', 'value']))
  } else {
    const connectives = assert_exists(possible_sentence_connectives[s.tag])
    const op = math_el('mo', {}, assert_exists(connectives[0]))
    return math_el('mrow', {}, wrap(s.left, ['negation', 'letter', 'value']), op, wrap(s.right, ['negation', 'letter', 'conjunction', 'value']))
  }
}

const single_input = (
  placeholder: string,
  callbacks: SingleInputCallbacks,
): SingleInput => {
  const DEFAULT_INPUT_WIDTH = placeholder.length
  const i = el('input', { type: 'input', class: 'text', style: `width: ${DEFAULT_INPUT_WIDTH}ch`, placeholder }) as HTMLInputElement
  const parse_error = new Editable<undefined | string>(undefined)
  const watch_group = new WatchGroup([])
  const constraint = new Editable<Constraint | undefined | { error: string }>(undefined)
  const info_message = new Editable<string>(INFO_MESSAGE_EMPTY)
  const info_button = el('input', { type: 'button', class: 'info' }) as HTMLButtonElement
  // const empty_display = el('input', { type: 'button', value: 'ⓘ How can I insert constraints?' })
  const constraint_display = el('div', { class: 'constraint' })
  // const error_display = el('span', { style: 'color: red; font-style: italic;' }, 'error')
  // const body = el('div', {}, i, constraint_display)

  watch_group.add(info_message.watch((info_message) => {
    info_button.value = info_message
  })).call()

  watch_group.add(constraint.watch((c) => {
    constraint_display.innerHTML = ''
    if (c === undefined) {
      callbacks.set_is_ready(self, false)
      info_message.set(INFO_MESSAGE_EMPTY)
      info_button.classList.remove('error')
      // constraint_display.appendChild(empty_display)
    } else if ('error' in c) {
      callbacks.set_is_ready(self, false)
      info_message.set(INFO_MESSAGE_ERROR)
      info_button.classList.add('error')
      // constraint_display.appendChild(error_display)
      // error_display.title = c.error
    } else {
      callbacks.set_is_ready(self, true)
      constraint_display.appendChild(constraint_to_html(c))
      info_message.set(INFO_MESSAGE_OKAY)
      info_button.classList.remove('error')
    }
  }))

  watch_group.add(parse_error.watch((pe) => {
    if (pe === undefined) {
      i.classList.remove('has-error')
    } else {
      i.classList.add('has-error')
    }
  }))

  i.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      console.log('enter!')
      callbacks.make_newline(self)
    } else if (event.key === 'ArrowUp') {
      callbacks.focus_prev(self)
    } else if (event.key === 'ArrowDown') {
      callbacks.focus_next(self)
    } else if (event.key === 'Backspace') {
      if (i.value.length === 0) {
        callbacks.remove(self)
      }
    }
  })

  i.addEventListener('input', () => {
    if (i.value.length > DEFAULT_INPUT_WIDTH) {
      i.style.width = `${i.value.length * 1}ch`
    } else {
      i.style.width = `${DEFAULT_INPUT_WIDTH}ch`
    }
  })

  i.addEventListener('input', debounce(DEFAULT_DEBOUNCE_MS, {
    lead: () => {
      constraint_display.classList.add('updating')
    },
    trail: () => {
      constraint_display.classList.remove('updating')
      if (i.value.length === 0) {
        constraint.set(undefined)
        return
      }

      const [status, parsed] = parse_constraint(i.value)
      if (!status) {
        constraint.set({ error: parsed })
        parse_error.set(parsed)
      } else {
        constraint.set(parsed)
        parse_error.set(undefined)
      }
    },
  }))

  i.addEventListener('focus', () => {
    e.classList.add('focused')
  })

  i.addEventListener('blur', () => {
    e.classList.remove('focused')
  })

  const close_button = el('input', { type: 'button', value: '⌫', class: 'close' })
  // body.appendChild(close_button)
  close_button.addEventListener('click', () => {
    callbacks.remove(self)
  })

  const newline_button = el('input', { type: 'button', value: '⏎', class: 'newline' })
  newline_button.addEventListener('click', () => {
    callbacks.make_newline(self)
  })

  const e = el('div', { class: 'single-input' },
    el('div', { style: 'display: flex;' },
        close_button,
        i,
        newline_button,
        info_button,
    ),
    constraint_display
  )

  e.addEventListener('click', () => {
    i.focus()
  })

  const self: SingleInput = { full: e, input: i, constraint, watch_group }
  return self
}

type MultiInput = {
  element: HTMLElement
  all_constraints: rEditable<Constraint[] | undefined>
}

const multi_input = (): MultiInput => {
  const children = new EditableDLL<SingleInput>([])
  const [all_are_ready, callbacks] = single_input_callbacks_after(children)
  const first = single_input(CONSTRAINT_INPUT_PLACEHOLDER, callbacks)
  children.insert_after(undefined, first)

  const all_constraints = new Editable<Constraint[] | undefined>(undefined)
  const parent = el('div', { class: 'multi-input' })

  children.watch_insert((to_insert, lead_sibling) => {
    if (lead_sibling === undefined) {
      parent.insertAdjacentElement('afterbegin', to_insert.full)
    } else {
      lead_sibling.full.insertAdjacentElement('afterend', to_insert.full)
    }
  }).call()
  children.watch_remove((to_remove) => {
    if (children.size() === 1) {
      throw new Error('Trying to remove the last element of a list!')
    } else {
      to_remove.full.remove()
    }
  })
  // 
  all_are_ready.watch((all_are_ready) => {
    if (all_are_ready) {
      const all_constraints_array: Constraint[] = []
      for (const si of children) {
        const constraint = si.constraint.get()
        if (constraint === undefined || 'error' in constraint) {
          throw new Error('multi_input.all_are_ready === true but there\'s a constraint that\'s not ready!')
        }
        all_constraints_array.push(constraint)
      }
      console.log('recomputing constraints!')
      all_constraints.set(all_constraints_array)
    } else {
      all_constraints.set(undefined)
    }
  })

  return { element: parent, all_constraints }
}

type ModelAssignmentOutput =
  | { tag: 'literal', value: number }
  | { tag: 'negative', inner: ModelAssignmentOutput }
  | { tag: 'rational', numerator: ModelAssignmentOutput, denominator: ModelAssignmentOutput }
  | { tag: 'root-obj', index: number, a: ModelAssignmentOutput, b: ModelAssignmentOutput, c: ModelAssignmentOutput}
  | { tag: 'unknown', s: S }

// // Should be *mostly* simplified, but still might run into issues so this function is here just in case.
// const simplify_model_assignment_output = (output: ModelAssignmentOutput): ModelAssignmentOutput => {
//   throw new Error('unimplemented')
// }

const parse_int = (a: string): Res<number, string> => {
  const as_int = parseInt (a)
  if (isNaN(as_int)) {
    return [false, `Parsing '${a}' as int gave a NaN!`]
  } else {
    return [true, as_int]
  }
}

const parse_float = (a: string): Res<number, string> => {
  const as_float = parseFloat(a)
  if (isNaN(as_float)) {
    return [false, `Parsing '${a}' as float gave a NaN!`]
  } else {
    return [true, as_float]
  }
}

const parse_and_evaluate = (s: S): number => {
  const [a, b, c, d] = [spv('a'), spv('b'), spv('c'), spv('d')]
  return match_s(s, [
    clause<{ a: 'string' }, number>({ a: 'string' }, a, (m) => {
      return assert_result(parse_float(m('a')))
    }),
    clause<{ a: 'string' }, number>({ a: 'string' }, ['-', a], (m) => {
      return -parse_and_evaluate(m('a'))
    }),
    clause<{ a: 'string', b: 'string' }, number>({ a: 'string', b: 'string' }, ['/', a, b], (m) => {
      return parse_and_evaluate(m('a')) / parse_and_evaluate(m('b'))
    }),
    // expect(parse_s('(root-obj (+ (* 8 (^ x 2)) (* 6 x) (- 1)) 2)'))
    clause<{ a: 's', b: 's', c: 's', d: 'string' }, number>(
      { a: 's', b: 's', c: 's', d: 'string' },
      ['root-obj', ['+', ['*', a], ['*', b], c], d],
      (m) => {
        const af = parse_and_evaluate(m('a'))
        const bf = parse_and_evaluate(m('b'))
        const cf = parse_and_evaluate(m('c'))
        const di = assert_result(parse_int(m('d')))

        // (-b +- sqrt(b^2 - 4ac)) / 2a
        const det = bf * bf - 4 * af * cf
        if (det < 0) {
          throw new Error('Evaluated value to complex number oops!')
        } else if (di === 1) {
          return (-bf - Math.sqrt(det)) / (2 * af)
        } else if (di === 2) {
          return (-bf + Math.sqrt(det)) / (2 * af)
        } else {
          throw new Error(`Unrecognized root index ${di}!`)
        }
      }),
  ])
}

const parse_to_assignment = (s: S): ModelAssignmentOutput => {
  const [a, b, c, d] = [spv('a'), spv('b'), spv('c'), spv('d')]
  return match_s(s, [
    clause<{ a: 'string' }, ModelAssignmentOutput>({ a: 'string' }, a, (m) => {
      const value = assert_result(parse_float(m('a')))
      return { tag: 'literal', value }
    }),
    clause<{ a: 'string' }, ModelAssignmentOutput>({ a: 'string' }, ['-', a], (m) => {
      const inner = parse_to_assignment(m('a'))
      return { tag: 'negative', inner }
    }),
    clause<{ a: 'string', b: 'string' }, ModelAssignmentOutput>({ a: 'string', b: 'string' }, ['/', a, b], (m) => {
      const numerator = parse_to_assignment(m('a'))
      const denominator = parse_to_assignment(m('b'))
      return { tag: 'rational', numerator, denominator }
    }),
    clause<{ a: 's', b: 's', c: 's', d: 'string' }, ModelAssignmentOutput>(
      { a: 's', b: 's', c: 's', d: 'string' },
      ['root-obj', ['+', ['*', a], ['*', b], c], d],
      (m) => {
        const af = parse_to_assignment(m('a'))
        const bf = parse_to_assignment(m('b'))
        const cf = parse_to_assignment(m('c'))
        const di = assert_result(parse_int(m('d')))

        return { tag: 'root-obj', index: di, a: af, b: bf, c: cf }
      }),
  ])
}

const model_to_assignments = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>): Promise<ModelAssignmentOutput[]> => {
  const assignments_map: Record<number, ModelAssignmentOutput> = {}
  const { simplify } = ctx
  for (const decl of model.decls()) {
    if (decl.arity() !== 0) {
      // throw new Error(`model includes a function declaration with arity not equal to zero!\nname: ${decl.name()}`)
      continue
    }
    const name = decl.name().toString()
    if (name.length < 3) {
      throw new Error(`Expected model entry name to be of length at least 3!\nname: ${name.length}`)
    }
    const index_str = name.substring(2)
    const index = parseInt(index_str)
    if (isNaN(index)) {
      throw new Error(`Expected model entry name to be of the form s_<number>!\nname: ${name}`)
    }

    const value_expr = await simplify(model.eval(decl.call()))
    const parsed_s = parse_s(value_expr.sexpr())
    const value = parse_to_assignment(parsed_s)
    assignments_map[index] = value
  }

  const values: ModelAssignmentOutput[] = []
  for (let i = 0; i < Object.keys(assignments_map).length; i++) {
    values.push(assignments_map[i])
  }
  return values
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
  const sub = (ma: ModelAssignmentOutput): Node => {
    if (ma.tag === 'literal') {
      return math_el('mi', {}, ma.value.toString())
    } else if (ma.tag === 'negative') {
      return math_el('mrow', {}, math_el('mo', {}, '-'), sub(ma.inner))
    } else if (ma.tag === 'rational') {
      return math_el('mfrac', {}, sub(ma.numerator), sub(ma.denominator))
    } else if (ma.tag === 'root-obj') {
      const b_2 = math_el('msup', {}, wrap(ma.b), math_el('mi', {}, '2'))
      const _4ac = math_el('mrow', {},
        math_el('mi', {}, '4'),
        math_el('mo', {}, '*'), wrap(ma.a),
        math_el('mo', {}, '*'), wrap(ma.c))
      const det = math_el('mrow', {}, math_el('mrow', {}, math_el('mo', {}, '-'), b_2), math_el('mo', {}, '-'), _4ac)
      const sqrt_det = math_el('msqrt', {}, det)
      assert(ma.index === 1 || ma.index === 2)
      const pm = math_el('mo', {}, ma.index === 1 ? '-' : '+')
      const num = math_el('mrow', {}, sub(ma.b), pm, sqrt_det)
      const den = math_el('mrow', {}, math_el('mi', {}, '2'), math_el('mo', {}, '*'), wrap(ma.a))
      return math_el('mfrac', {}, num, den)
    } else if (ma.tag === 'unknown') {
      return el('span', {}, s_to_string(ma.s))
    } else {
      throw new Error('model_assignment_to_display fallthrough')
    }
  }

  return math_el('math', {}, sub(ma))
}

const state_id = (index: number | string): MathMLElement =>
  math_el('msub', {}, math_el('mi', {}, 'a'), math_el('mi', {}, index.toString()))

const model_display = async <CtxKey extends string>(ctx: Context<CtxKey>, model: [TruthTable, Model<CtxKey>]): Promise<HTMLElement> => {
  const [tt, z3_model] = model
  const model_assignments = await model_to_assignments(ctx, z3_model)
  const body = el('tbody', {})
  const head = el('thead', {},
    el('tr', {},
      el('th', {}, 'State'),
      el('th', {}, state_id('i')),
      el('th', {}, 'Assignment')))
  for (const [index, ma] of model_assignments.entries()) {
    const state = tt.state_from_index(index)
    const state_string = sentence_to_string(state)
    const assignment_html = model_assignment_display(ma)
    const row = el('tr', {},
      el('td', {}, state_string),
      el('td', {}, state_id(index)),
      el('td', {}, assignment_html))
    body.appendChild(row)
  }
  const e = el('table', {},
    head,
    body)
  return e
}

type Z3ContextState =
  | { tag: 'loading' }
  | { tag: 'ready', ctx: Context }
  | { tag: 'error', message: string }

const main = (): HTMLElement => {
  const mi = multi_input()
  const is_regular = new Editable(false)
  const z3_state = new Editable<Z3ContextState>({ tag: 'loading' })
  const generate_button = el('input', { type: 'button', value: 'Generate', class: 'generate' }) as HTMLButtonElement
  const options_button = el('input', { type: 'button', value: '⚙', class: 'options' }) as HTMLButtonElement
  const z3_status_container = el('div', { style: 'margin-left: 0.4em;' })
  const generate_line = el('div', { style: 'display: flex;' }, generate_button, options_button, z3_status_container)
  const regular_toggle = el('input', { type: 'checkbox' }, 'Regular') as HTMLInputElement
  const model_container = el('div', { class: 'model-container' })

  mi.all_constraints.watch((all_constraints) => {
    if (all_constraints === undefined) {
      generate_button.disabled = true
    } else {
      generate_button.disabled = false
    }
  }).call()

  regular_toggle.addEventListener('change', () => {
    is_regular.set(regular_toggle.checked)
  })

  const load_z3 = async (): Promise<Context> => {
    const { Context } = await init_z3()
    return Context('main')
  }

  load_z3()
    .then((ctx) => {
      z3_state.set({ tag: 'ready', ctx })
    })
    .catch((error) => {
      z3_state.set({ tag: 'error', message: error.message })
    })
  
  z3_state.watch((state) => {
    z3_status_container.innerHTML = ''
    if (state.tag === 'loading') {
      z3_status_container.append('Loading Z3...')
      generate_button.disabled = true
    } else if (state.tag === 'ready') {
      z3_is_ready(state.ctx)
      generate_button.disabled = false
    } else if (state.tag === 'error') {
      z3_status_container.append(state.message)
      z3_status_container.style.color = 'red'
      if (state.message === 'Out of memory') {
        z3_status_container.append('.  Try closing and re-opening the tab or window.')
      }
      generate_button.disabled = true
    } else {
      throw new Error('')
    }
  }).call()

  const z3_is_ready = (ctx: Context) => {
    generate_button.addEventListener('click', async () => {
      console.log('clicked generate!')
      const constraints = assert_exists(mi.all_constraints.get(), 'Generate button clicked but not all constraints ready!')
      console.log('constraints:', constraints.map(constraint_to_string))

      model_container.innerHTML = ''
      try {
        const { status, all_constraints, tt, model } = await pr_sat(ctx, constraints, is_regular.get())
        if (status === 'sat') {
          console.log('sat!')
          const model_html = await model_display(ctx, [tt, model])
          model_container.appendChild(model_html)
        } else {
          console.log(status)
          model_container.append(status)
        }

        for (const constraint of all_constraints) {
          const e = constraint_to_html(constraint)
          model_container.appendChild(el('div', { style: 'margin-top: 0.4em;' }, e))
        }

      } catch (e: any) {
        model_container.appendChild(el('div', { style: 'color: red;' },
          el('div', {}, 'Exception!'),
          e.message))
      }
    })
  }

  return el('div', {},
    mi.element,
    generate_line,
    regular_toggle,
    model_container,
  )
}

if (!hasMathMLSupport()) {
  alert('No mathML support :(')
  throw new Error('No mathML support :(')
}

root.appendChild(main())

// (async () => {
//   root.append('loading...')
//   const { Context } = await init_z3()
//   root.innerHTML = ''
//   const ctx = Context('main')
//   root.appendChild(main(ctx))
// })()
// .then(() => {
//   console.log('loaded z3!')
// })
// .catch((error) => {
//   root.innerHTML = ''
//   const error_el = el('div', { style: 'color: red; display: block;' },
//     el('div', {}, 'There was an error loading z3.'),
//     el('div', {}, 'Try closing out of this tab and opening it back up again.'),
//   )
//   if (error instanceof RangeError) {
//     console.log('yes it is a RangeError')
//     if (error.message === 'Out of memory') {
//       error_el.appendChild(el('div', {}, '(This error happens when you reload the page too frequently)'))
//     }
//   }
//   root.append(error_el)
// })
// .finally(() => {
//   console.log('we done anyway')
// })
