import { Context } from "z3-solver";
import { Editable, EditableDLL, rEditable, WatchGroup } from './editable';
import { el, math_el } from "./el";
import { assert, assert_exists, NumericKeys, Res } from "./utils";
import { debounce } from "./debounce";
import { parse_constraint, parse_constraint_or_real_expr } from "./parser";
import { possible_constraint_connectives, possible_sentence_connectives, TruthTable, variables_in_constraints } from "./pr_sat";
import { evaluate_constraint, evaluate_real_expr, init_z3, ModelAssignmentOutput, pr_sat_with_truth_table } from "./z3_integration";
import { s_to_string } from "./s";

import './style.css'
import { ConstraintOrRealExpr, PrSat, SentenceMap } from "./types";
import { Equiv } from "./tag_map";

import * as TestId from '../tests/test_ids'
import { TestIdGenerator } from "../tests/test_ids";

const DEFAULT_DEBOUNCE_MS = 150
const CONSTRAINT_INPUT_PLACEHOLDER = 'Enter constraint'
const BATCH_CONSTRAINT_INPUT_PLACEHOLDER = 'Enter constraints separated by newlines'
const EVALUATOR_INPUT_PLACEHOLDER = 'Enter expression'
const BATCH_EVALUATOR_INPUT_PLACEHOLDER = 'Enter expressions separated by newlines'
const INFO_MESSAGE_EMPTY = 'ⓘ How?'
const INFO_MESSAGE_ERROR = 'ⓘ Error!'
const INFO_MESSAGE_OKAY = 'ⓘ'
const FIND_MODEL_BUTTON_LABEL = 'Find Model'
const DEFAULT_MULTI_INPUT_MODE: 'Batch' | 'Multi' = 'Multi'
const CONSTRAINT_INPUT_INSTRUCTIONS = `
To insert a [Constraint], type in one of:
- '[RealExpr] = [RealExpr]' for equality,
- '[RealExpr] ≠ [RealExpr]' or '[RealExpr] != [RealExpr]' for disequality,
- '[RealExpr] < [RealExpr]' for less than,
- '[RealExpr] > [RealExpr]' for greater than,
- '[RealExpr] ≤ [RealExpr]' or '[RealExpr] <= [RealExpr] for less than or equal to,'
- '[RealExpr] ≥ [RealExpr]' or '[RealExpr] >= [RealExpr] for greater than or equal to,'
- '~[Constraint]', '![Constraint]', or '-[Constraint]' for negation,
- '[Constraint] ∨ [Constraint]' or '[Constraint] \\/ [Constraint]' for disjunction (hint: the '∨' is NOT a v),
- '[Constraint] & [Constraint]' for conjunction,
- '[Constraint] → [Constraint]', '[Constraint] -> [Constraint]', or '[Constraint] > [Constraint]' for biconditional,
- '[Constraint] ↔ [Constraint]', '[Constraint] <-> [Constraint]', or '[Constraint] <> [Constraint]' for biconditional.

To insert a [RealExpr], type in one of:
- Any number (integer or decimal),
- 'Pr([Sentence])' for probability,
- 'Pr([Sentence] | [Sentence])' for conditional probability,
- '-[RealExpr]' for negatives,
- '[RealExpr] + [RealExpr]' for addition,
- '[RealExpr] - [RealExpr]' for subtraction,
- '[RealExpr] * [RealExpr]' for multiplication,
- '[RealExpr] / [RealExpr]' for division,
- '[RealExpr]^[RealExpr]' for exponentiation.

To insert a [Sentence], type in one of:
- '⊤' or 'true' for truth (hint: the ⊤ is read as 'top', not 'tee'),
- '⊥' or 'false' for falsity,
- Any upper-case letter for propositional variable, optionally followed by an integer > 0,
- '~[Sentence]', '![Sentence]', or '-[Sentence]' for negation,
- '[Sentence] ∨ [Sentence]' or '[Sentence] \\/ [Sentence]' for disjunction (hint: the '∨' is NOT a v),
- '[Sentence] & [Sentence]' for conjunction,
- '[Sentence] → [Sentence]', '[Sentence] -> [Sentence]', or '[Sentence] > [Sentence]' for biconditional,
- '[Sentence] ↔ [Sentence]', '[Sentence] <-> [Sentence]', or '[Sentence] <> [Sentence]' for biconditional.
`.trim()
const CONSTRAINT_OR_REAL_EXPR_INPUT_INSTRUCTIONS = `
You can either insert a Constraint or a Real Expression.

${CONSTRAINT_INPUT_INSTRUCTIONS}
`.trim()

const root = assert_exists(document.getElementById('app'), 'Root element with id \'#app\' doesn\'t exist!')

type Constraint = PrSat['Constraint']
type RealExpr = PrSat['RealExpr']
type Sentence = PrSat['Sentence']

type SingleInputCallbacks<ParseOutput extends {}> = {
  siblings: EditableDLL<SingleInput<ParseOutput>>
  set_is_ready: (si: SingleInput<ParseOutput>, is_ready: boolean) => void
  make_newline: (si: SingleInput<ParseOutput>) => void
  remove: (si: SingleInput<ParseOutput>) => void
  focus_first: () => void
  focus_next: (si: SingleInput<ParseOutput>) => void
  focus_prev: (si: SingleInput<ParseOutput>) => void
}

type SingleInput<ParseOutput extends {}> = {
  full: HTMLElement
  input: HTMLInputElement
  watch_group: WatchGroup<unknown>
  constraint: rEditable<ParseOutput | undefined | { error: string }>
  set_text: (text: string) => void
}

const single_input_callbacks_after = <ParseOutput extends {}>(
  test_id_gen: TestIdGenerator,
  siblings: EditableDLL<SingleInput<ParseOutput>>,
  placeholder: string,
  input_instructions: string,
  parser: (text: string) => Res<ParseOutput, string>,
  display: (output: ParseOutput) => Element,
): [Editable<boolean>, SingleInputCallbacks<ParseOutput>] => {
  const ready_set = new Set<SingleInput<ParseOutput>>()
  const all_are_ready = new Editable(false)
  const recheck_ready = () => {
    if (ready_set.size === siblings.size()) {
      all_are_ready.set(true)
    } else if (all_are_ready.get() === true && ready_set.size < siblings.size()) {
      all_are_ready.set(false)
    }
  }
  const self: SingleInputCallbacks<ParseOutput> = {
    siblings,
    set_is_ready: (si, is_ready) => {
      if (is_ready) {
        ready_set.add(si)
      } else {
        ready_set.delete(si)
      }
      recheck_ready()
    },
    make_newline: (si: SingleInput<ParseOutput>) => {
      const new_input = single_input(test_id_gen, placeholder, input_instructions, parser, display, self)
      siblings.insert_after(si, new_input)
      new_input.input.focus()
      recheck_ready()
    },
    remove: (si: SingleInput<ParseOutput>) => {
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
    focus_next: (si: SingleInput<ParseOutput>) => {
      const next_sibling = siblings.get_next(si)
      next_sibling?.input.focus()
    },
    focus_prev: (si: SingleInput<ParseOutput>) => {
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

const letter_string = (l: SentenceMap['letter']): string =>
  `${l.id}${l.index > 0 ? l.index : ''}`
  

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
    const id = letter_string(s)
    return math_el('mi', { mathvariant: 'normal' }, id)
  } else if (s.tag === 'negation') {
    const op = math_el('mo', {}, '~')
    return math_el('mrow', {}, op, wrap(s.sentence, ['negation', 'letter', 'value']))
  } else {
    const connectives = assert_exists(possible_sentence_connectives[s.tag])
    const op = math_el('mo', {}, assert_exists(connectives[0]))
    return math_el('mrow', {}, wrap(s.left, ['negation', 'letter', 'value']), op, wrap(s.right, ['negation', 'letter', 'conjunction', 'value']))
  }
}

const single_input = <ParseOutput extends {}>(
  test_id_gen: TestIdGenerator,
  placeholder: string,
  input_instructions: string,
  parser: (text: string) => Res<ParseOutput, string>,
  display: (output: ParseOutput) => Element,
  callbacks: SingleInputCallbacks<ParseOutput>,
): SingleInput<ParseOutput> => {
  const DEFAULT_INPUT_WIDTH = placeholder.length
  const i = tel(TestId.single_input.input, 'input', { type: 'input', class: 'text', style: `width: ${DEFAULT_INPUT_WIDTH}ch`, placeholder }) as HTMLInputElement
  const parse_error = new Editable<undefined | string>(undefined)
  const watch_group = new WatchGroup([])
  const constraint = new Editable<ParseOutput | undefined | { error: string }>(undefined)
  const info_message = new Editable<string>(INFO_MESSAGE_EMPTY)
  const info_button = el('input', { type: 'button', class: 'info' }) as HTMLButtonElement
  const info_element = el('div', { style: 'white-space: pre-wrap; margin-top: 0.4em;' }, input_instructions)
  const info_error_element = el('div', { class: 'error', style: 'white-space: pre-wrap; margin-top: 0.4em;' })
  const info_container = el('div', { class: 'info-container' }, info_error_element, info_element)
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
      constraint_display.appendChild(display(c))
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
        parse_error.set(undefined)
        constraint.set(undefined)
        return
      }

      const [status, parsed] = parser(i.value)
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
  close_button.addEventListener('click', () => {
    callbacks.remove(self)
  })

  const newline_button = tel(TestId.single_input.newline, 'input', { type: 'button', value: '⏎', class: 'newline' })
  newline_button.addEventListener('click', () => {
    callbacks.make_newline(self)
  })

  const e = tel(test_id_gen.gen(), 'div', { class: 'single-input' },
    el('div', { style: 'display: flex;' },
      el('div', { style: 'display: flex;' },
          close_button,
          i,
          newline_button,
          info_button,
      ),
      constraint_display
    ),
    info_container,
  )

  e.addEventListener('click', () => {
    i.focus()
  })

  const show_info = new Editable(false)
  info_button.onclick = () => {
    show_info.set(!show_info.get())
  }

  parse_error.watch((error) => {
    if (error === undefined) {
      info_error_element.style.display = 'none'
    } else {
      info_error_element.style.display = 'block'
      info_error_element.innerHTML = ''
      info_error_element.append(`Error: ${error}`)
    }
  })

  show_info.watch((show_info) => {
    if (show_info) {
      info_container.style.display = 'block'
    } else {
      info_container.style.display = 'none'
    }
  }).call()

  const set_text = (text: string) => {
    const input_event = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    })
    i.value = text
    i.dispatchEvent(input_event)
  }

  const self: SingleInput<ParseOutput> = { full: e, input: i, constraint, watch_group, set_text }
  return self
}

type MultiInput<ParseOutput extends {}> = {
  element: HTMLElement
  all_constraints: rEditable<ParseOutput[] | undefined>
  get_fields: () => string[]
  set_fields: (fields: string[]) => void
  refresh: () => void
}

const multi_input = <ParseOutput extends {}>(
  test_id_gen: TestIdGenerator,
  input_placeholder: string,
  input_instructions: string,
  parser: (text: string) => Res<ParseOutput, string>,
  display: (output: ParseOutput) => Element,
): MultiInput<ParseOutput> => {
  const children = new EditableDLL<SingleInput<ParseOutput>>([])
  const [all_are_ready, callbacks] = single_input_callbacks_after(test_id_gen, children, input_placeholder, input_instructions, parser, display)
  const first = single_input(test_id_gen, input_placeholder, input_instructions, parser, display, callbacks)
  const all_constraints = new Editable<ParseOutput[] | undefined>(undefined)
  children.insert_after(undefined, first)

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

  all_are_ready.watch((all_are_ready) => {
    if (all_are_ready) {
      const all_constraints_array: ParseOutput[] = []
      for (const si of children) {
        const constraint = si.constraint.get()
        if (constraint === undefined || 'error' in constraint) {
          throw new Error('multi_input.all_are_ready === true but there\'s a constraint that\'s not ready!')
        }
        all_constraints_array.push(constraint)
      }
      all_constraints.set(all_constraints_array)
    } else {
      all_constraints.set(undefined)
    }
  })

  const get_fields = (): string[] => {
    const fields: string[] = []
    for (const child of children) {
      const f = child.input.value
      fields.push(f)
    }
    return fields
  }

  const set_fields = (fields: string[]) => {
    if (fields.length <= children.size()) {
      for (const [index, child] of children.entries()) {
        if (index < fields.length) {
          const f = assert_exists(fields[index], 'fields[index] is undefined!')
          child.set_text(f)
        } else {
          if (child === first) {
            child.set_text('')
          } else {
            children.remove(child)
          }
        }
      }
    } else if (fields.length > children.size()) {
      let last_child: SingleInput<ParseOutput> | undefined = undefined
      for (const [index, child] of children.entries()) {
        console.log(child.full)
        const f = assert_exists(fields[index], 'fields[index] is undefined!')
        child.set_text(f)
        last_child = child
      }

      for (let beyond_index = children.size(); beyond_index < fields.length; beyond_index++) {
        const f = assert_exists(fields[beyond_index], 'fields[beyond_index] is undefined!')
        const new_child = single_input(test_id_gen, input_placeholder, input_instructions, parser, display, callbacks)
        console.log(new_child.full)
        new_child.set_text(f)
        children.insert_after(last_child, new_child)
        last_child = new_child
      }
    }
  }

  const refresh = () => {
    for (const child of children) {
      child.set_text(child.input.value)
    }
  }

  return { element: parent, all_constraints, set_fields, get_fields, refresh }
}

const update_constraints_view = <ParseOutput extends {}>(
  view: HTMLElement,
  parsed_lines: Res<ParseOutput, string>[],
  display: (output: ParseOutput) => Element,
): void => {
  view.innerHTML = ''
  for (const [status, constraint] of parsed_lines) {
    if (status) {
      const constraint_view = display(constraint)
      view.appendChild(el('div', {}, constraint_view))
    } else {
      const error_view = el('span', { class: 'error' }, 'Error!')
      view.appendChild(el('div', {}, error_view))
    }
  }
}

// From https://stackoverflow.com/questions/13405129/create-and-save-a-file-with-javascript
const download = (data: string, filename: string, type: string): void => {
  const file = new Blob([data], {type: type});
  const a = document.createElement("a"),
          url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);  
  }, 0); 
}

const batch_input = <ParseOutput extends {}>(
  input_placeholder: string,
  input_instructions: string,
  parser: (text: string) => Res<ParseOutput, string>,
  display: (output: ParseOutput) => Element,
): MultiInput<ParseOutput> => {
  const PARSE_BUTTON_EMPTY = 'Nothing to parse'  // in_sync = true, contains_error = false
  const PARSE_BUTTON_ERROR = 'Fix error before reparsing!'  // contains_error = true
  const PARSE_BUTTON_OUT_OF_SYNC = 'Parse'  // in_sync = false
  const PARSE_BUTTON_IN_SYNC = 'Up to date!'

  const in_sync = new Editable(false)
  const contains_error = new Editable(false)
  const info_toggle = new Editable(false)

  const info_button = el('input', {type: 'button', value: 'Show input instructions' }) as HTMLButtonElement
  const info_container = el('div', { style: 'white-space: pre-wrap; margin-bottom: 0.4em;' },
    `Insert a list of [Constraint]s separated by a newline.\n\n${input_instructions}`)
  const file_loader = el('input', { type: 'file', value: 'Load input', title: ' ' }) as HTMLInputElement
  const pre_button_line = el('div', { class: 'button-line', style: 'margin-bottom: 0.4em;' }, file_loader, info_button)
  const parse_button = el('input', { type: 'button', value: '', class: 'button' }) as HTMLButtonElement
  const save_button = el('input', { type: 'button', value: 'Save input', class: 'button' }) as HTMLButtonElement
  const button_line = el('div', { class: 'button-line' }, parse_button, save_button)
  const textbox = el('textarea', { placeholder: input_placeholder, style: 'display: block; border-radius: 0.4em;', rows: '10', cols: '50' }) as HTMLTextAreaElement
  const constraints_view = el('div', { style: 'margin-top: 0.4em;' })
  const all_constraints = new Editable<ParseOutput[] | undefined>(undefined)

  const set_state = (in_sync: boolean, contains_error: boolean): void => {
    parse_button.disabled = textbox.value === '' || in_sync
    save_button.disabled = textbox.value === ''

    if (textbox.value === '') {
      parse_button.value = PARSE_BUTTON_EMPTY
    } else if (in_sync && contains_error) {
      parse_button.value = PARSE_BUTTON_ERROR
    } else if (in_sync && !contains_error) {
      parse_button.value = PARSE_BUTTON_IN_SYNC
    } else if (!in_sync && contains_error) {
      parse_button.value = PARSE_BUTTON_OUT_OF_SYNC
    } else if (!in_sync && !contains_error) {
      parse_button.value = PARSE_BUTTON_OUT_OF_SYNC
    }

    if (contains_error) {
      textbox.classList.add('has-error')
    } else {
      textbox.classList.remove('has-error')
    }
  }

  in_sync.watch((in_sync) => set_state(in_sync, contains_error.get()))
  contains_error.watch((contains_error) => set_state(in_sync.get(), contains_error)).call()

  info_toggle.watch((info_toggle) => {
    if (info_toggle) {
      info_container.style.display = 'block'
    } else {
      info_container.style.display = 'none'
    }
  }).call()

  info_button.onclick = () => {
    info_toggle.set(!info_toggle.get())
  }

  textbox.addEventListener('input', () => {
    in_sync.set(false)
  })

  const parse = (): void => {
    const textbox_value = textbox.value.trim()
    if (textbox_value === '') {
      return
    }

    const lines = textbox_value.split('\n')
    const parsed_lines = lines.map(parser)
    const good_lines: ParseOutput[] = []

    for (const [status, constraint] of parsed_lines) {
      if (status) {
        good_lines.push(constraint)
      }
    }

    if (good_lines.length === parsed_lines.length) {
      // No bad lines let's go!
      all_constraints.set(good_lines)
      contains_error.set(false)
    } else {
      all_constraints.set(undefined)
      contains_error.set(true)
    }

    update_constraints_view(constraints_view, parsed_lines, display)
    in_sync.set(true)
  }

  parse_button.onclick = () => {
    parse()
  }

  save_button.onclick = () => {
    download(textbox.value, 'constraints.txt', 'text/plain')
  }

  file_loader.onchange = async () => {
    const files = assert_exists(file_loader.files, 'file_loader.files is null!')
    assert(files.length === 1, `Number of files in file_loader != 1!\nactually: ${files.length}`)
    const f = assert_exists(files[0], 'files[0] is null!')
    textbox.value = await f.text()
    parse()
  }

  const get_fields = (): string[] => {
    const lines = textbox.value.split('\n')
    return lines
  }

  const set_fields = (fields: string[]) => {
    textbox.value = fields.join('\n')
  }

  const refresh = () => {
    parse()
  }

  const element = el('div', { class: 'common-element batch-input' },
    pre_button_line,
    info_container,
    textbox,
    button_line,
    constraints_view)
  return { element, all_constraints, get_fields, set_fields, refresh }
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
      const det = math_el('mrow', {}, b_2, math_el('mo', {}, '-'), _4ac)
      const sqrt_det = math_el('msqrt', {}, det)
      assert(ma.index === 1 || ma.index === 2)
      const pm = math_el('mo', {}, ma.index === 1 ? '-' : '+')
      const num = math_el('mrow', {}, math_el('mrow', {}, math_el('mo', {}, '-'), wrap(ma.b)), pm, sqrt_det)
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

const state_id = (index: number | string): MathMLElement => {
  const i = typeof index === 'number' ? index + 1 : index
  return math_el('msub', {}, math_el('mi', {}, 'a'), math_el('mi', {}, i.toString()))
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
    row.appendChild(el('td', { class: 'dv' }))
    body.appendChild(row)
  }
  const e = el('table', {},
    head,
    body)
  return e
}

const model_display = (model: [TruthTable, Record<number, ModelAssignmentOutput>]): HTMLElement => {
  // One column per sentence-letter
  // Header has the form "A1 | A2 | ... | An | a_i | Assignment"

  const [tt, model_assignments] = model
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
  head_row.appendChild(el('th', {}, 'Assignment'))

  for (const [i, ma] of Object.entries(model_assignments)) {  // rows
    const index = parseInt(i)
    const assignment_html = model_assignment_display(ma)
    const row = el('tr', {})
    for (const l of tt.letters()) {
      const letter_value = tt.letter_value_from_index(l, index)  // Scary parseInt!
      const value_string = letter_value ? '⊤' : '⊥'
      row.appendChild(el('td', {}, value_string))
    }
    row.appendChild(el('td', { class: 'dv' }))
    row.appendChild(el('td', {}, state_id(index)))
    row.appendChild(el('td', { class: 'dv' }))
    row.appendChild(el('td', {}, assignment_html))
    body.appendChild(row)
  }
  const e = tel(TestId.model_table, 'table', {},
    head,
    body)
  return e
}

const simple_options_display = <const Options extends string[]>(options: Options, def: Options[NumericKeys<Options>]): { element: HTMLElement, options: Editable<Options[NumericKeys<Options>]> } => {
  const element = el('div', {})
  const opts = new Editable<Options[NumericKeys<Options>]>(def)
  const options_map = new Map<Options[keyof Options], { element: HTMLButtonElement }>()

  for (const o of options) {
    const oe = el('input', { type: 'button', value: o, class: 'button' }, o) as HTMLButtonElement
    options_map.set(o as any, { element: oe })
    element.appendChild(oe)

    oe.onclick = () => {
      opts.set(o as any)
    }
  }

  opts.watch((o) => {
    for (const [other_o, { element: other_element }] of options_map.entries()) {
      other_element.disabled = o === other_o
    }
  }).call()

  return { element, options: opts }
}

type ModelFinderState =
  | { tag: 'waiting' }
  | { tag: 'looking', truth_table: TruthTable }
  | { tag: 'sat', truth_table: TruthTable, assignments: Record<number, ModelAssignmentOutput>, state_values: Record<number, number> }
  | { tag: 'unsat' }
  | { tag: 'unknown' }
  | { tag: 'invalidated', last: { truth_table: TruthTable, state_values: Record<number, number> } }

type ModelFinderDisplay = {
  element: HTMLElement
  state: rEditable<ModelFinderState>
  start_search: (ctx: Context, constraints: Constraint[], is_regular: boolean) => Promise<void>
  invalidate: () => void
}

const display_constraint_or_real_expr = (e: ConstraintOrRealExpr): Element => {
  if (e.tag === 'constraint') {
    return constraint_to_html(e.constraint)
  } else {
    return real_expr_to_html(e.real_expr)
  }
}

const evaluate_constraint_or_real_expr = (tt: TruthTable, state_values: Record<number, number>, e: ConstraintOrRealExpr): boolean | number => {
  if (e.tag === 'constraint') {
    return evaluate_constraint(tt, state_values, e.constraint)
  } else if (e.tag === 'real_expr') {
    return evaluate_real_expr(tt, state_values, e.real_expr)
  } else {
    const check: Equiv<typeof e, never> = true
    void check
    throw new Error('evaluate_constraint_or_real_expr fallthrough')
  }
}

const value_to_string = (value: boolean | number): string => {
  if (typeof value === 'boolean') {
    return value ? '⊤' : '⊥'
  } else if (typeof value === 'number') {
    return value.toString()
  } else {
    const check: Equiv<typeof value, never> = true
    void check
    throw new Error('value_to_string fallthrough')
  }
}

type ModelEvaluator = {
  element: HTMLElement
  multi_input: MultiInput<ConstraintOrRealExpr>
}

const model_evaluators = (model_assignments: rEditable<{ truth_table: TruthTable, values: Record<number, number> } | undefined>): ModelEvaluator => {
  const display_constraint_or_real_expr_with_evaluation = (e: ConstraintOrRealExpr): Element => {
    const d = display_constraint_or_real_expr(e)
    const assignments = model_assignments.get()
    if (assignments === undefined) {
      return d
    } else {
      // Weird that we're evaluating in a display function but I don't care.
      const value = evaluate_constraint_or_real_expr(assignments.truth_table, assignments.values, e)
      return el('div', { style: 'display: flex;' },
        d,
        el('span', { style: 'margin-left: 0.4em; margin-right: 0.4em;' }, '⟾'),
        value_to_string(value))
    }
  }

  const mi = generic_multi_input(
    TestId.single_input.eval,
    EVALUATOR_INPUT_PLACEHOLDER,
    BATCH_EVALUATOR_INPUT_PLACEHOLDER,
    CONSTRAINT_OR_REAL_EXPR_INPUT_INSTRUCTIONS,
    parse_constraint_or_real_expr,
    display_constraint_or_real_expr_with_evaluation)

  const element = el('div', { class: 'model-evaluators' },
    el('div', { style: 'margin-bottom: 0.4em;' }, 'Evaluate model'),
    mi.element,
  )
  return { element, multi_input: mi }
}

const model_finder_display = (): ModelFinderDisplay => {
  const state = new Editable<ModelFinderState>({ tag: 'waiting' })
  const model_assignments = new Editable<{ truth_table: TruthTable, values: Record<number, number> } | undefined>(undefined)
  const model_container = el('div', { class: 'model-container' })
  const state_display = el('div', {})
  const left_side = el('div', {},
    state_display,
    model_container,
  )
  const evaluators = model_evaluators(model_assignments)
  const right_side = el('div', {},
    // evaluators.element,  // Will be added in the state watcher.
  )
  const split_view = el('div', { style: 'display: flex;' },
    left_side,
    right_side,
  )
  const constraints_view = el('div', {})

  const start_search = async (ctx: Context, constraints: Constraint[], is_regular: boolean): Promise<void> => {
    const truth_table = new TruthTable(variables_in_constraints(constraints))
    state.set({ tag: 'looking', truth_table })
    model_container.innerHTML = ''
    try {
      const tt_display = truth_table_display(truth_table)
      model_container.appendChild(tt_display)
      const { status, all_constraints, state_values, model } = await pr_sat_with_truth_table(ctx, truth_table, constraints, is_regular)
      if (status === 'sat') {
        state.set({ tag: 'sat', truth_table, assignments: model, state_values })
      } else if (status === 'unsat') {
        state.set({ tag: 'unsat' })
      } else if (status === 'unknown') {
        state.set({ tag: 'unknown' })
      } else {
        const check: Equiv<typeof status, never> = true
        void check
      }

      constraints_view.innerHTML = ''
      // constraints_view.append('Constraints:')
      for (const constraint of all_constraints) {
        const e = constraint_to_html(constraint)
        constraints_view.appendChild(el('div', { style: 'margin-top: 0.4em;' }, e))
      }

    } catch (e: any) {
      model_container.appendChild(el('div', { style: 'color: red;' },
        el('div', {}, 'Exception!'),
        e.message))
    }
  }

  const invalidate = (): void => {
    const last_state = state.get()
    if (last_state.tag === 'invalidated') {
      // do nothing!
    } else if (last_state.tag === 'sat') {
      state.set({ tag: 'invalidated', last: last_state })
    } else {
      state.set({ tag: 'waiting' })
    }
  }

  const element = el('div', { class: 'model-finder' },
    split_view,
    constraints_view,
  )

  state.watch((state) => {
    // Logic
    console.log('state set!', state.tag)
    if (state.tag === 'sat') {
      model_assignments.set({ truth_table: state.truth_table, values: state.state_values })
      evaluators.multi_input.refresh()
    } else if (state.tag === 'invalidated') {
      evaluators.multi_input.refresh()
    } else if (state.tag === 'unsat') {
      model_assignments.set(undefined)
    }
    
    // Display
    element.classList.remove('invalidated')
    if (state.tag === 'waiting') {
      right_side.innerHTML = ''
      state_display.innerHTML = ''
      state_display.append('No model to display!')
      element.classList.add('invalidated')
      model_container.innerHTML = ''
      constraints_view.innerHTML = ''
    } else if (state.tag === 'looking') {
      state_display.innerHTML = ''
      state_display.append('Searching for model satisfying constraints...')
    } else if (state.tag === 'sat') {
      state_display.innerHTML = ''
      state_display.append('Constraints are SATisfiable!')
      const model_html = model_display([state.truth_table, state.assignments])
      model_container.innerHTML = ''
      model_container.appendChild(model_html)
      right_side.appendChild(evaluators.element)
    } else if (state.tag === 'unknown') {
      state_display.innerHTML = ''
      state_display.append('Unable to determine if constraints are satisfiable')
    } else if (state.tag === 'unsat') {
      state_display.innerHTML = ''
      state_display.append('Constraints are UNSATisfiable.')
      right_side.innerHTML = ''
    } else if (state.tag === 'invalidated') {
      state_display.innerHTML = ''
      state_display.append('No up-to-date model to display')
      element.classList.add('invalidated')
    } else {
      const check: Equiv<typeof state, never> = true
      void check
    }
  })

  return { element, state, start_search, invalidate }
}

type Z3ContextState =
  | { tag: 'loading' }
  | { tag: 'ready', ctx: Context }
  | { tag: 'error', message: string }

const generic_multi_input = <ParseOutput extends {}>(
  test_id_gen: TestIdGenerator,
  single_input_placeholder: string,
  batch_input_placeholder: string,
  input_instructions: string,
  parser: (text: string) => Res<ParseOutput, string>,
  display: (output: ParseOutput) => Element,
  default_mode: 'Multi' | 'Batch' = DEFAULT_MULTI_INPUT_MODE
): MultiInput<ParseOutput> => {
  const all_constraints = new Editable<ParseOutput[] | undefined>(undefined)
  const display_picker = simple_options_display(['Multi', 'Batch'], default_mode)
  const input_container = el('div', {})
  display_picker.element.style.marginBottom = '0.4em'
  const input_elements_map = {
    'Multi': multi_input(test_id_gen, single_input_placeholder, input_instructions, parser, display),
    'Batch': batch_input(batch_input_placeholder, input_instructions, parser, display),
  } as const
  let current_mi = input_elements_map[default_mode]

  display_picker.options.watch((display_code, last_display_code) => {
    current_mi = input_elements_map[display_code]
    input_container.innerHTML = ''
    input_container.appendChild(current_mi.element)
    // all_constraints.set(current_mi.all_constraints.get())

    if (last_display_code !== undefined) {
      const last_mi = assert_exists(input_elements_map[last_display_code])
      if (last_mi) {
        current_mi.set_fields(last_mi.get_fields())
      }
    }
  }).call()

  for (const current_input of Object.values(input_elements_map)) {
    current_input.all_constraints.watch((constraints) => {
      all_constraints.set(constraints)
    }).call()
  }

  const get_fields = (): string[] => {
    return current_mi.get_fields()
  }

  const set_fields = (fields: string[]) => {
    current_mi.set_fields(fields)
  }

  const refresh = () => {
    for (const input of Object.values(input_elements_map)) {
      input.refresh()
    }
  }

  const element = el('div', {},
    display_picker.element,
    input_container,
  )
  return { element, all_constraints, get_fields, set_fields, refresh }
}

const tel = (test_id: string, name: string, attrs: Record<string, string>, ...children: (Node | string)[]): HTMLElement => {
  return el(name, { ...attrs, 'data-testid': test_id }, ...children)
}

const main = (): HTMLElement => {
  const is_regular = new Editable(false)
  const z3_state = new Editable<Z3ContextState>({ tag: 'loading' })
  const generate_button = tel(TestId.find_model, 'input', { type: 'button', value: FIND_MODEL_BUTTON_LABEL, class: 'generate' }) as HTMLButtonElement
  const options_button = el('input', { type: 'button', value: '⚙', class: 'options' }) as HTMLButtonElement
  const z3_status_container = tel(TestId.z3_status, 'div', { style: 'margin-left: 0.4em;' })
  const generate_line = el('div', { style: 'display: flex; margin-top: 0.4em;' }, generate_button, options_button, z3_status_container)
  const regular_toggle = tel(TestId.regular_toggle, 'input', { type: 'checkbox' }, 'Regular') as HTMLInputElement
  const mi = generic_multi_input(TestId.single_input.constraint, CONSTRAINT_INPUT_PLACEHOLDER, BATCH_CONSTRAINT_INPUT_PLACEHOLDER, CONSTRAINT_INPUT_INSTRUCTIONS, parse_constraint, constraint_to_html)
  const model_finder = model_finder_display()

  const set_all_constraints = (all_constraints: Constraint[] | undefined) => {
    model_finder.invalidate()
    if (all_constraints === undefined) {
      generate_button.disabled = true
    } else {
      generate_button.disabled = false
    }
  }

  is_regular.watch(() => {
    model_finder.invalidate()
  })

  mi.all_constraints.watch((all_constraints) => {
    set_all_constraints(all_constraints)
  })

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
      set_all_constraints(mi.all_constraints.get())
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
      const constraints = assert_exists(mi.all_constraints.get(), 'Generate button clicked but not all constraints ready!')
      await model_finder.start_search(ctx, constraints, is_regular.get())
    })
  }

  return el('div', {},
    el('div', { class: 'model-input' },
      mi.element,
      generate_line,
      regular_toggle,
    ),
    model_finder.element,
  )
}

if (!hasMathMLSupport()) {
  alert('No mathML support :(')
  throw new Error('No mathML support :(')
}

root.appendChild(main())
