import { Context } from "z3-solver";
import { Editable, rEditable } from './editable';
import { el, math_el, tel } from "./el";
import { assert, assert_exists, fallthrough, Res } from "./utils";
import { parse_constraint, parse_constraint_or_real_expr } from "./parser";
import { constraint_to_string, evaluate_constraint_2, evaluate_real_expr_2, EvaluationError, sentence_to_string, TruthTable, VariableLists, variables_in_constraints } from "./pr_sat";
import { init_z3, ModelAssignmentOutput, pr_sat_with_truth_table } from "./z3_integration";
import { s_to_string } from "./s";
import { ConstraintOrRealExpr, PrSat } from "./types";
import { Equiv } from "./tag_map";
import { InputBlockLogic } from "./display_logic";
import { constraint_to_html, letter_string, real_expr_to_html, state_id } from "./prsat_to_html";
import { generic_input_block, split_input, SplitInput } from "./block_playground";

import * as TestId from '../tests/test_ids'
import * as Constants from './constants'

import './style.css'

const root = assert_exists(document.getElementById('app'), 'Root element with id \'#app\' doesn\'t exist!')

type Constraint = PrSat['Constraint']
// type RealExpr = PrSat['RealExpr']
// type Sentence = PrSat['Sentence']

// type SingleInputCallbacks<ParseOutput extends {}> = {
//   siblings: EditableDLL<SingleInput<ParseOutput>>
//   set_is_ready: (si: SingleInput<ParseOutput>, is_ready: boolean) => void
//   make_newline: (si: SingleInput<ParseOutput>) => void
//   remove: (si: SingleInput<ParseOutput>) => void
//   focus_first: () => void
//   focus_next: (si: SingleInput<ParseOutput>) => void
//   focus_prev: (si: SingleInput<ParseOutput>) => void
// }

// type SingleInput<ParseOutput extends {}> = {
//   full: HTMLElement
//   input: HTMLInputElement
//   watch_group: WatchGroup<unknown>
//   constraint: rEditable<ParseOutput | undefined | { error: string }>
//   set_text: (text: string) => void
// }

// const single_input_callbacks_after = <ParseOutput extends {}>(
//   test_id_gen: TestIdGenerator,
//   siblings: EditableDLL<SingleInput<ParseOutput>>,
//   placeholder: string,
//   input_instructions: string,
//   parser: (text: string) => Res<ParseOutput, string>,
//   display: (output: ParseOutput) => Element,
// ): [Editable<boolean>, SingleInputCallbacks<ParseOutput>] => {
//   const ready_set = new Set<SingleInput<ParseOutput>>()
//   const all_are_ready = new Editable(false)
//   const recheck_ready = () => {
//     if (ready_set.size === siblings.size()) {
//       all_are_ready.set(true)
//     } else if (all_are_ready.get() === true && ready_set.size < siblings.size()) {
//       all_are_ready.set(false)
//     }
//   }
//   const self: SingleInputCallbacks<ParseOutput> = {
//     siblings,
//     set_is_ready: (si, is_ready) => {
//       if (is_ready) {
//         ready_set.add(si)
//       } else {
//         ready_set.delete(si)
//       }
//       recheck_ready()
//     },
//     make_newline: (si: SingleInput<ParseOutput>) => {
//       const new_input = single_input(test_id_gen, placeholder, input_instructions, parser, display, self)
//       siblings.insert_after(si, new_input)
//       new_input.input.focus()
//       recheck_ready()
//     },
//     remove: (si: SingleInput<ParseOutput>) => {
//       if (siblings.size() === 1) {
//         // Don't do it!
//       } else {
//         const prev_sibling = siblings.get_previous(si)
//         if (prev_sibling !== undefined) {
//           prev_sibling?.input.focus()
//           prev_sibling?.input.setSelectionRange(0, 0)
//         } else {
//           const next_sibling = siblings.get_next(si)
//           next_sibling?.input.focus()
//           next_sibling?.input.setSelectionRange(0, 0)
//         }
//         siblings.remove(si)
//         si.watch_group.unwatch()
//         ready_set.delete(si)
//         recheck_ready()
//       }
//     },
//     focus_first: () => {
//       siblings.at(0)?.full.focus()
//     },
//     focus_next: (si: SingleInput<ParseOutput>) => {
//       const next_sibling = siblings.get_next(si)
//       next_sibling?.input.focus()
//     },
//     focus_prev: (si: SingleInput<ParseOutput>) => {
//       const prev_sibling = siblings.get_previous(si)
//       prev_sibling?.input.focus()
//     },
//   }
//   return [all_are_ready, self]
// }

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


// const single_input = <ParseOutput extends {}>(
//   test_id_gen: TestIdGenerator,
//   placeholder: string,
//   input_instructions: string,
//   parser: (text: string) => Res<ParseOutput, string>,
//   display: (output: ParseOutput) => Element,
//   callbacks: SingleInputCallbacks<ParseOutput>,
// ): SingleInput<ParseOutput> => {
//   const DEFAULT_INPUT_WIDTH = placeholder.length
//   const i = tel(TestId.single_input.input, 'input', { type: 'input', class: 'text', style: `width: ${DEFAULT_INPUT_WIDTH}ch`, placeholder }) as HTMLInputElement
//   const parse_error = new Editable<undefined | string>(undefined)
//   const watch_group = new WatchGroup([])
//   const constraint = new Editable<ParseOutput | undefined | { error: string }>(undefined)
//   const info_message = new Editable<string>(Constants.INFO_MESSAGE_EMPTY)
//   const info_button = el('input', { type: 'button', class: 'info' }) as HTMLButtonElement
//   const info_element = el('div', { class: 'input-instructions', style: 'white-space: pre-wrap; margin-top: 0.4em;' }, input_instructions)
//   const info_error_element = el('div', { class: 'error', style: 'white-space: pre-wrap; margin-top: 0.4em;' })
//   const info_container = el('div', { class: 'info-container' }, info_error_element, info_element)
//   // const empty_display = el('input', { type: 'button', value: 'ⓘ How can I insert constraints?' })
//   const constraint_display = el('div', { class: 'constraint' })
//   // const error_display = el('span', { style: 'color: red; font-style: italic;' }, 'error')
//   // const body = el('div', {}, i, constraint_display)

//   watch_group.add(info_message.watch((info_message) => {
//     info_button.value = info_message
//   })).call()

//   watch_group.add(constraint.watch((c) => {
//     constraint_display.innerHTML = ''
//     if (c === undefined) {
//       callbacks.set_is_ready(self, false)
//       info_message.set(Constants.INFO_MESSAGE_EMPTY)
//       info_button.classList.remove('error')
//       // constraint_display.appendChild(empty_display)
//     } else if ('error' in c) {
//       callbacks.set_is_ready(self, false)
//       info_message.set(Constants.INFO_MESSAGE_ERROR)
//       info_button.classList.add('error')
//       // constraint_display.appendChild(error_display)
//       // error_display.title = c.error
//     } else {
//       callbacks.set_is_ready(self, true)
//       constraint_display.appendChild(display(c))
//       info_message.set(Constants.INFO_MESSAGE_OKAY)
//       info_button.classList.remove('error')
//     }
//   }))

//   watch_group.add(parse_error.watch((pe) => {
//     if (pe === undefined) {
//       i.classList.remove('has-error')
//     } else {
//       i.classList.add('has-error')
//     }
//   }))

//   i.addEventListener('keydown', (event) => {
//     if (event.key === 'Enter') {
//       callbacks.make_newline(self)
//     } else if (event.key === 'ArrowUp') {
//       callbacks.focus_prev(self)
//     } else if (event.key === 'ArrowDown') {
//       callbacks.focus_next(self)
//     } else if (event.key === 'Backspace') {
//       if (i.value.length === 0) {
//         callbacks.remove(self)
//       }
//     }
//   })

//   i.addEventListener('input', () => {
//     if (i.value.length > DEFAULT_INPUT_WIDTH) {
//       i.style.width = `${i.value.length * 1}ch`
//     } else {
//       i.style.width = `${DEFAULT_INPUT_WIDTH}ch`
//     }
//   })

//   i.addEventListener('input', debounce(Constants.DEFAULT_DEBOUNCE_MS, {
//     lead: () => {
//       constraint_display.classList.add('updating')
//     },
//     trail: () => {
//       console.log('INPUT EVENT')
//       constraint_display.classList.remove('updating')
//       if (i.value.length === 0) {
//         parse_error.set(undefined)
//         constraint.set(undefined)
//         return
//       }

//       const [status, parsed] = parser(i.value)
//       if (!status) {
//         constraint.set({ error: parsed })
//         parse_error.set(parsed)
//       } else {
//         constraint.set(parsed)
//         parse_error.set(undefined)
//       }
//     },
//   }))

//   i.addEventListener('focus', () => {
//     e.classList.add('focused')
//   })

//   i.addEventListener('blur', () => {
//     e.classList.remove('focused')
//   })

//   const close_button = tel(TestId.single_input.close, 'input', { type: 'button', value: '⌫', class: 'close' })
//   close_button.addEventListener('click', () => {
//     callbacks.remove(self)
//   })

//   const newline_button = tel(TestId.single_input.newline, 'input', { type: 'button', value: '⏎', class: 'newline' })
//   newline_button.addEventListener('click', () => {
//     callbacks.make_newline(self)
//   })

//   const e = tel(test_id_gen.gen(), 'div', { class: 'single-input' },
//     el('div', { style: 'display: flex;' },
//       el('div', { style: 'display: flex;' },
//           close_button,
//           i,
//           newline_button,
//           info_button,
//       ),
//       constraint_display
//     ),
//     info_container,
//   )

//   e.addEventListener('click', () => {
//     i.focus()
//   })

//   const show_info = new Editable(false)
//   info_button.onclick = () => {
//     show_info.set(!show_info.get())
//   }

//   parse_error.watch((error) => {
//     if (error === undefined) {
//       info_error_element.style.display = 'none'
//     } else {
//       info_error_element.style.display = 'block'
//       info_error_element.innerHTML = ''
//       info_error_element.append(`Error: ${error}`)
//     }
//   })

//   show_info.watch((show_info) => {
//     if (show_info) {
//       info_container.style.display = 'block'
//     } else {
//       info_container.style.display = 'none'
//     }
//   }).call()

//   const set_text = (text: string) => {
//     const input_event = new InputEvent('input', {
//       bubbles: true,
//       cancelable: true,
//       inputType: 'insertText',
//       data: text,
//     })
//     i.value = text
//     i.dispatchEvent(input_event)
//   }

//   const self: SingleInput<ParseOutput> = { full: e, input: i, constraint, watch_group, set_text }
//   return self
// }

// type MultiInput<ParseOutput extends {}> = {
//   element: HTMLElement
//   all_constraints: rEditable<ParseOutput[] | undefined>
//   get_fields: () => string[]
//   set_fields: (fields: string[]) => void
//   refresh: () => void
// }

// const multi_input = <ParseOutput extends {}>(
//   test_ids: TestId.GenericMultiInputTestIds['multi'],
//   test_id_gen: TestIdGenerator,
//   input_placeholder: string,
//   input_instructions: string,
//   parser: (text: string) => Res<ParseOutput, string>,
//   display: (output: ParseOutput) => Element,
//   block_logic: InputBlockLogic<ParseOutput>,
// ): MultiInput<ParseOutput> => {
//   const children = new EditableDLL<SingleInput<ParseOutput>>([])
//   const [all_are_ready, callbacks] = single_input_callbacks_after(test_id_gen, children, input_placeholder, input_instructions, parser, display)
//   const first = single_input(test_id_gen, input_placeholder, input_instructions, parser, display, callbacks)
//   const all_constraints = new Editable<ParseOutput[] | undefined>(undefined)
//   children.insert_after(undefined, first)

//   const parent = tel(test_ids.id, 'div', { class: 'multi-input' })

//   children.watch_insert((to_insert, lead_sibling) => {
//     if (lead_sibling === undefined) {
//       parent.insertAdjacentElement('afterbegin', to_insert.full)
//     } else {
//       lead_sibling.full.insertAdjacentElement('afterend', to_insert.full)
//     }
//   }).call()

//   children.watch_remove((to_remove) => {
//     if (children.size() === 1) {
//       throw new Error('Trying to remove the last element of a list!')
//     } else {
//       to_remove.full.remove()
//     }
//   })

//   all_are_ready.watch((all_are_ready) => {
//     console.log('all-are-ready-is-called!')
//     if (all_are_ready) {
//       console.log('all-are-ready')
//       const all_constraints_array: ParseOutput[] = []
//       for (const si of children) {
//         const constraint = si.constraint.get()
//         if (constraint === undefined || 'error' in constraint) {
//           throw new Error('multi_input.all_are_ready === true but there\'s a constraint that\'s not ready!')
//         }
//         all_constraints_array.push(constraint)
//       }
//       all_constraints.set(all_constraints_array)
//     } else {
//       console.log('all-are-not-ready')
//       all_constraints.set(undefined)
//     }
//   })

//   const get_fields = (): string[] => {
//     const fields: string[] = []
//     for (const child of children) {
//       const f = child.input.value
//       fields.push(f)
//     }
//     return fields
//   }

//   const set_fields = (fields: string[]) => {
//     if (fields.length <= children.size()) {
//       for (const [index, child] of children.entries()) {
//         if (index < fields.length) {
//           const f = assert_exists(fields[index], 'fields[index] is undefined!')
//           child.set_text(f)
//         } else {
//           if (child === first) {
//             child.set_text('')
//           } else {
//             children.remove(child)
//           }
//         }
//       }
//     } else if (fields.length > children.size()) {
//       let last_child: SingleInput<ParseOutput> | undefined = undefined
//       for (const [index, child] of children.entries()) {
//         console.log(child.full)
//         const f = assert_exists(fields[index], 'fields[index] is undefined!')
//         child.set_text(f)
//         last_child = child
//       }

//       for (let beyond_index = children.size(); beyond_index < fields.length; beyond_index++) {
//         const f = assert_exists(fields[beyond_index], 'fields[beyond_index] is undefined!')
//         const new_child = single_input(test_id_gen, input_placeholder, input_instructions, parser, display, callbacks)
//         console.log(new_child.full)
//         new_child.set_text(f)
//         children.insert_after(last_child, new_child)
//         last_child = new_child
//       }
//     }
//   }

//   const refresh = () => {
//     for (const child of children) {
//       child.set_text(child.input.value)
//     }
//   }

//   return { element: parent, all_constraints, set_fields, get_fields, refresh }
// }

// const update_constraints_view = <ParseOutput extends {}>(
//   view: HTMLElement,
//   parsed_lines: Res<ParseOutput, string>[],
//   display: (output: ParseOutput) => Element,
// ): void => {
//   view.innerHTML = ''
//   for (const [status, constraint] of parsed_lines) {
//     if (status) {
//       const constraint_view = display(constraint)
//       view.appendChild(el('div', {}, constraint_view))
//     } else {
//       const error_view = el('span', { class: 'error' }, 'Error!')
//       view.appendChild(el('div', {}, error_view))
//     }
//   }
// }

// const batch_input = <ParseOutput extends {}>(
//   test_ids: TestId.GenericMultiInputTestIds['batch'],
//   input_placeholder: string,
//   input_instructions: string,
//   parser: (text: string) => Res<ParseOutput, string>,
//   display: (output: ParseOutput) => Element,
//   block_logic: InputBlockLogic<ParseOutput>,
// ): MultiInput<ParseOutput> => {
//   const PARSE_BUTTON_EMPTY = 'Nothing to parse'  // in_sync = true, contains_error = false
//   const PARSE_BUTTON_ERROR = 'Fix error before reparsing!'  // contains_error = true
//   const PARSE_BUTTON_OUT_OF_SYNC = 'Parse'  // in_sync = false
//   const PARSE_BUTTON_IN_SYNC = 'Up to date!'

//   const in_sync = new Editable(false)
//   const contains_error = new Editable(false)
//   const info_toggle = new Editable(false)

//   const info_button = el('input', {type: 'button', value: 'Show input instructions' }) as HTMLButtonElement
//   const info_container = el('div', { style: 'white-space: pre-wrap; margin-bottom: 0.4em;' },
//     `Insert a list of [Constraint]s separated by a newline.\n\n${input_instructions}`)
//   const file_loader = el('input', { type: 'file', value: 'Load input', title: ' ' }) as HTMLInputElement
//   const pre_button_line = el('div', { class: 'button-line', style: 'margin-bottom: 0.4em;' }, file_loader, info_button)
//   const parse_button = el('input', { type: 'button', value: '', class: 'button' }) as HTMLButtonElement
//   const save_button = el('input', { type: 'button', value: 'Save input', class: 'button' }) as HTMLButtonElement
//   const button_line = el('div', { class: 'button-line' }, parse_button, save_button)
//   const textbox = tel(test_ids.textbox, 'textarea', { placeholder: input_placeholder, style: 'display: block; border-radius: 0.4em;', rows: '10', cols: '50' }) as HTMLTextAreaElement
//   const constraints_view = el('div', { style: 'margin-top: 0.4em;' })
//   const all_constraints = new Editable<ParseOutput[] | undefined>(undefined)

//   const set_state = (in_sync: boolean, contains_error: boolean): void => {
//     parse_button.disabled = textbox.value === '' || in_sync
//     save_button.disabled = textbox.value === ''

//     if (textbox.value === '') {
//       parse_button.value = PARSE_BUTTON_EMPTY
//     } else if (in_sync && contains_error) {
//       parse_button.value = PARSE_BUTTON_ERROR
//     } else if (in_sync && !contains_error) {
//       parse_button.value = PARSE_BUTTON_IN_SYNC
//     } else if (!in_sync && contains_error) {
//       parse_button.value = PARSE_BUTTON_OUT_OF_SYNC
//     } else if (!in_sync && !contains_error) {
//       parse_button.value = PARSE_BUTTON_OUT_OF_SYNC
//     }

//     if (contains_error) {
//       textbox.classList.add('has-error')
//     } else {
//       textbox.classList.remove('has-error')
//     }
//   }

//   in_sync.watch((in_sync) => set_state(in_sync, contains_error.get()))
//   contains_error.watch((contains_error) => set_state(in_sync.get(), contains_error)).call()

//   info_toggle.watch((info_toggle) => {
//     if (info_toggle) {
//       info_container.style.display = 'block'
//     } else {
//       info_container.style.display = 'none'
//     }
//   }).call()

//   info_button.onclick = () => {
//     info_toggle.set(!info_toggle.get())
//   }

//   textbox.addEventListener('input', () => {
//     in_sync.set(false)
//   })

//   const parse = (): void => {
//     const textbox_value = textbox.value.trim()
//     if (textbox_value === '') {
//       return
//     }

//     const lines = textbox_value.split('\n')
//     const parsed_lines = lines.map(parser)
//     const good_lines: ParseOutput[] = []

//     for (const [status, constraint] of parsed_lines) {
//       if (status) {
//         good_lines.push(constraint)
//       }
//     }

//     if (good_lines.length === parsed_lines.length) {
//       // No bad lines let's go!
//       all_constraints.set(good_lines)
//       contains_error.set(false)
//     } else {
//       all_constraints.set(undefined)
//       contains_error.set(true)
//     }

//     update_constraints_view(constraints_view, parsed_lines, display)
//     in_sync.set(true)
//   }

//   parse_button.onclick = () => {
//     parse()
//   }

//   save_button.onclick = () => {
//     download(textbox.value, 'constraints.txt', 'text/plain')
//   }

//   file_loader.onchange = async () => {
//     const files = assert_exists(file_loader.files, 'file_loader.files is null!')
//     assert(files.length === 1, `Number of files in file_loader != 1!\nactually: ${files.length}`)
//     const f = assert_exists(files[0], 'files[0] is null!')
//     textbox.value = await f.text()
//     parse()
//   }

//   const get_fields = (): string[] => {
//     const lines = textbox.value.split('\n')
//     return lines
//   }

//   const set_fields = (fields: string[]) => {
//     const text = fields.join('\n')
//     const input_event = new InputEvent('input', {
//       bubbles: true,
//       cancelable: true,
//       inputType: 'insertText',
//       data: text,
//     })
//     textbox.value = fields.join('\n')
//     textbox.dispatchEvent(input_event)
//     parse()
//   }

//   const refresh = () => {
//     parse()
//   }

//   const element = tel(test_ids.id, 'div', { class: 'common-element batch-input' },
//     pre_button_line,
//     info_container,
//     textbox,
//     button_line,
//     constraints_view)
//   return { element, all_constraints, get_fields, set_fields, refresh }
// }

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

// const simple_options_display = <const Options extends string[]>(test_id_prefix: string, options: Options, def: Options[NumericKeys<Options>]): { element: HTMLElement, options: Editable<Options[NumericKeys<Options>]> } => {
//   const element = tel(TestId.mode_select_id, 'div', {})
//   const opts = new Editable<Options[NumericKeys<Options>]>(def)
//   const options_map = new Map<Options[keyof Options], { element: HTMLButtonElement }>()

//   for (const o of options) {
//     const oe = tel(TestId.mode_select_button(test_id_prefix, o), 'input', { type: 'button', value: o, class: 'button' }, o) as HTMLButtonElement
//     options_map.set(o as any, { element: oe })
//     element.appendChild(oe)

//     oe.onclick = () => {
//       opts.set(o as any)
//     }
//   }

//   opts.watch((o) => {
//     for (const [other_o, { element: other_element }] of options_map.entries()) {
//       other_element.disabled = o === other_o
//     }
//   }).call()

//   return { element, options: opts }
// }

type ModelFinderState =
  | { tag: 'waiting' }
  | { tag: 'looking', truth_table: TruthTable }
  | { tag: 'sat', truth_table: TruthTable, assignments: Record<number, ModelAssignmentOutput>, state_values: Record<number, number> }
  | { tag: 'unsat', truth_table: TruthTable }
  | { tag: 'unknown' }
  | { tag: 'invalidated', last: { truth_table: TruthTable, state_values: Record<number, number> } }

type ModelFinderDisplay = {
  element: HTMLElement
  state: rEditable<ModelFinderState>
  start_search: (ctx: Context, constraints: Constraint[], is_regular: boolean) => Promise<void>
  invalidate: () => void
}

const display_constraint_or_real_expr = (e: ConstraintOrRealExpr, wrap_in_math_element: boolean): Element => {
  if (e.tag === 'constraint') {
    return constraint_to_html(e.constraint, wrap_in_math_element)
  } else {
    return real_expr_to_html(e.real_expr, wrap_in_math_element)
  }
}

const evaluate_constraint_or_real_expr = (tt: TruthTable, state_values: Record<number, number>, e: ConstraintOrRealExpr): Res<boolean | number, EvaluationError> => {
  if (e.tag === 'constraint') {
    return evaluate_constraint_2(tt, state_values, e.constraint)
  } else if (e.tag === 'real_expr') {
    return evaluate_real_expr_2(tt, state_values, e.real_expr)
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

const undeclared_variables_string = (vlists: VariableLists): string => {
  let result = 'Undeclared variables: '
  if (vlists.real.length === 0 && vlists.sentence.length === 0) {
    return 'Undeclared variables!'
  }

  if (vlists.real.length > 0) {
    result += vlists.real.join(', ')
    if (vlists.sentence.length > 0) {
      result += ', '
    }
  }
  if (vlists.sentence.length > 0) {
    result += vlists.sentence.map(sentence_to_string).join(', ')
  }

  return result
}

const constraint_to_real_expr_result_to_html = (e: Res<boolean | number, EvaluationError>): Element => {
  const [status, value] = e
  if (status) {
    return math_el('mtext', {}, value_to_string(value))
  } else if (value.tag === 'div0') {
    return math_el('mtext', { class: 'error' }, 'Division by 0!')
  } else if (value.tag === 'undeclared-vars') {
    return math_el('mtext', { class: 'error' }, undeclared_variables_string(value.vars))
  } else {
    return fallthrough('constraint_to_real_expr_result_to_html', value)
  }
}

type ModelEvaluator = {
  element: HTMLElement
  // multi_input: MultiInput<ConstraintOrRealExpr>
  refresh: () => void
}

const model_evaluators = (model_assignments: rEditable<{ truth_table: TruthTable, values: Record<number, number> } | undefined>): ModelEvaluator => {
  const display_constraint_or_real_expr_with_evaluation = (e: ConstraintOrRealExpr): Element => {
    const d = display_constraint_or_real_expr(e, false)
    const assignments = model_assignments.get()
    if (assignments === undefined) {
      return d
    } else {
      // Weird that we're evaluating in a display function but I don't care.
      const result = evaluate_constraint_or_real_expr(assignments.truth_table, assignments.values, e)
      const result_html = constraint_to_real_expr_result_to_html(result)
      return math_el('math', {},
        d,
        math_el('mo', { class: 'yields' }, '⟾'),
        result_html)
    }
  }

  // const mi = generic_multi_input(
  //   TestId.generic_multi_input('eval'),
  //   TestId.single_input.eval,
  //   Constants.EVALUATOR_INPUT_PLACEHOLDER,
  //   Constants.BATCH_EVALUATOR_INPUT_PLACEHOLDER,
  //   Constants.CONSTRAINT_OR_REAL_EXPR_INPUT_INSTRUCTIONS,
  //   parse_constraint_or_real_expr,
  //   display_constraint_or_real_expr_with_evaluation)
  const eval_block = new InputBlockLogic<ConstraintOrRealExpr, SplitInput>(
    parse_constraint_or_real_expr,
    (logic) => split_input(logic, display_constraint_or_real_expr_with_evaluation, Constants.EVALUATOR_INPUT_PLACEHOLDER, TestId.single_input.eval))
  const mi = generic_input_block(eval_block, Constants.BATCH_EVALUATOR_INPUT_PLACEHOLDER)

  const refresh = () => {
    for (const input of eval_block.get_inputs()) {
      input.text.set(input.text.get())
    }
  }

  const element = el('div', { class: 'model-evaluators' },
    el('div', { style: 'margin-bottom: 0.4em;' }, 'Evaluate model'),
    mi.element,
  )
  return { element, refresh  }
}

const model_finder_display = (constraint_block: InputBlockLogic<Constraint, SplitInput>): ModelFinderDisplay => {
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
  const split_view = el('div', { style: 'display: flex; margin-top: 0.4em;' },
    left_side,
    right_side,
  )
  const constraints_view = el('div', {})

  const generate_button = tel(TestId.find_model, 'input', { type: 'button', value: Constants.FIND_MODEL_BUTTON_LABEL, class: 'generate' }) as HTMLButtonElement
  // const options_button = el('input', { type: 'button', value: '⚙', class: 'options' }) as HTMLButtonElement
  const z3_status_container = tel(TestId.z3_status, 'div', { style: 'margin-left: 0.4em;' })
  const is_regular = new Editable(false)
  const regular_toggle = tel(TestId.regular_toggle, 'input', { type: 'checkbox', style: 'margin-left: 0.4em;' }, 'Regular') as HTMLInputElement
  const z3_state = new Editable<Z3ContextState>({ tag: 'loading' })
  const generate_line = el('div', { style: 'display: flex;' },
    generate_button,
    // el('input', { type: 'button', value: Constants.FIND_MODEL_BUTTON_LABEL, class: 'generate' }) as HTMLButtonElement,
    // options_button,
    el('label', {},
      regular_toggle,
      'Regular',
    ),
    z3_status_container)

  const set_all_constraints = (all_constraints: Constraint[] | undefined) => {
    console.log('on_ready', all_constraints?.map(constraint_to_string))
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
      set_all_constraints(constraint_block.get_output())
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
      const constraints = assert_exists(constraint_block.get_output(), 'Generate button clicked but not all constraints ready!')
      await start_search(ctx, constraints, is_regular.get())
    })
  }

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
        state.set({ tag: 'unsat', truth_table })
      } else if (status === 'unknown') {
        state.set({ tag: 'unknown' })
      } else {
        const check: Equiv<typeof status, never> = true
        void check
      }

      constraints_view.innerHTML = ''
      for (const constraint of all_constraints) {
        const e = constraint_to_html(constraint, true)
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

  const model_part = el('div', {},
    split_view,
    constraints_view,
  )

  const element = el('div', { class: 'model-finder' },
    generate_line,
    model_part,
  )

  state.watch((state) => {
    // Logic
    if (state.tag === 'sat') {
      model_assignments.set({ truth_table: state.truth_table, values: state.state_values })
      // evaluators.multi_input.refresh()
      evaluators.refresh()
    } else if (state.tag === 'invalidated') {
      // evaluators.multi_input.refresh()
      evaluators.refresh()
    } else if (state.tag === 'unsat') {
      model_assignments.set(undefined)
    }
    
    // Display
    model_part.classList.remove('invalidated')
    if (state.tag === 'waiting') {
      right_side.innerHTML = ''
      state_display.innerHTML = ''
      state_display.append('No model to display!')
      model_part.classList.add('invalidated')
      model_container.innerHTML = ''
      constraints_view.innerHTML = ''
    } else if (state.tag === 'looking') {
      state_display.innerHTML = ''
      state_display.append('Searching for model satisfying constraints...')
    } else if (state.tag === 'sat') {
      state_display.innerHTML = ''
      state_display.append(Constants.SAT)
      const model_html = model_display(state.truth_table, state.assignments)
      model_container.innerHTML = ''
      model_container.appendChild(model_html)
      right_side.appendChild(evaluators.element)
    } else if (state.tag === 'unknown') {
      state_display.innerHTML = ''
      state_display.append('Unable to determine if constraints are satisfiable')
    } else if (state.tag === 'unsat') {
      state_display.innerHTML = ''
      state_display.append(Constants.UNSAT)
      right_side.innerHTML = ''
    } else if (state.tag === 'invalidated') {
      state_display.innerHTML = ''
      state_display.append('No up-to-date model to display')
      model_part.classList.add('invalidated')
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

// const generic_multi_input = <ParseOutput extends {}>(
//   test_ids: TestId.GenericMultiInputTestIds,  // different from gen!
//   test_id_gen: TestIdGenerator,
//   single_input_placeholder: string,
//   batch_input_placeholder: string,
//   input_instructions: string,
//   parser: (text: string) => Res<ParseOutput, string>,
//   display: (output: ParseOutput) => Element,
//   default_mode: 'Multi' | 'Batch' = Constants.DEFAULT_MULTI_INPUT_MODE
// ): MultiInput<ParseOutput> => {
//   const all_constraints = new Editable<ParseOutput[] | undefined>(undefined)
//   const display_picker = simple_options_display(test_ids.id, ['Multi', 'Batch'], default_mode)
//   const input_container = el('div', {})
//   display_picker.element.style.marginBottom = '0.4em'
//   const block_logic = new InputBlockLogic(parser, (logic) => single_input(test_id_gen, single_input_placeholder, input_instructions, parser, display, single_input_callbacks_after))
//   const input_elements_map = {
//     'Multi': multi_input(test_ids.multi, test_id_gen, single_input_placeholder, input_instructions, parser, display, block_logic),
//     'Batch': batch_input(test_ids.batch, batch_input_placeholder, input_instructions, parser, display, block_logic),
//   } as const
//   let current_mi = input_elements_map[default_mode]

//   display_picker.options.watch((display_code, last_display_code) => {
//     current_mi = input_elements_map[display_code]
//     input_container.innerHTML = ''
//     input_container.appendChild(current_mi.element)

//     if (last_display_code !== undefined) {
//       const last_mi = assert_exists(input_elements_map[last_display_code])
//       if (last_mi) {
//         current_mi.set_fields(last_mi.get_fields())
//       }
//     }
//   }).call()

//   for (const current_input of Object.values(input_elements_map)) {
//     current_input.all_constraints.watch((constraints) => {
//       all_constraints.set(constraints)
//     }).call()
//   }

//   const get_fields = (): string[] => {
//     return current_mi.get_fields()
//   }

//   const set_fields = (fields: string[]) => {
//     current_mi.set_fields(fields)
//   }

//   const refresh = () => {
//     for (const input of Object.values(input_elements_map)) {
//       input.refresh()
//     }
//   }

//   const element = el('div', {},
//     display_picker.element,
//     input_container,
//   )
//   return { element, all_constraints, get_fields, set_fields, refresh }
// }

const main = (): HTMLElement => {
  // const generate_button = tel(TestId.find_model, 'input', { type: 'button', value: Constants.FIND_MODEL_BUTTON_LABEL, class: 'generate' }) as HTMLButtonElement
  // const options_button = el('input', { type: 'button', value: '⚙', class: 'options' }) as HTMLButtonElement
  // const z3_state = new Editable<Z3ContextState>({ tag: 'loading' })
  // const z3_status_container = tel(TestId.z3_status, 'div', { style: 'margin-left: 0.4em;' })
  // const generate_line = el('div', { style: 'display: flex; margin-top: 0.4em;' }, generate_button, options_button, z3_status_container)
  // const is_regular = new Editable(false)
  // const regular_toggle = tel(TestId.regular_toggle, 'input', { type: 'checkbox' }, 'Regular') as HTMLInputElement
  // const mi = generic_multi_input(TestId.generic_multi_input('constraints'), TestId.single_input.constraint, Constants.CONSTRAINT_INPUT_PLACEHOLDER, Constants.BATCH_CONSTRAINT_INPUT_PLACEHOLDER, Constants.CONSTRAINT_INPUT_INSTRUCTIONS, parse_constraint, constraint_to_html)
  const constraint_block = new InputBlockLogic<Constraint, SplitInput>(
    parse_constraint,
    (logic) => split_input(logic, (c) => constraint_to_html(c, true), Constants.CONSTRAINT_INPUT_PLACEHOLDER, TestId.single_input.constraint))
  const mi = generic_input_block(constraint_block, Constants.BATCH_CONSTRAINT_INPUT_PLACEHOLDER)

  const model_finder = model_finder_display(constraint_block)

  // const set_all_constraints = (all_constraints: Constraint[] | undefined) => {
  //   model_finder.invalidate()
  //   if (all_constraints === undefined) {
  //     generate_button.disabled = true
  //   } else {
  //     generate_button.disabled = false
  //   }
  // }

  // is_regular.watch(() => {
  //   model_finder.invalidate()
  // })

  // constraint_block.on_ready((all_constraints) => {
  //   set_all_constraints(all_constraints)
  // })
  // regular_toggle.addEventListener('change', () => {
  //   is_regular.set(regular_toggle.checked)
  // })

  // const load_z3 = async (): Promise<Context> => {
  //   const { Context } = await init_z3()
  //   return Context('main')
  // }

  // load_z3()
  //   .then((ctx) => {
  //     z3_state.set({ tag: 'ready', ctx })
  //   })
  //   .catch((error) => {
  //     z3_state.set({ tag: 'error', message: error.message })
  //   })
  
  // z3_state.watch((state) => {
  //   z3_status_container.innerHTML = ''
  //   if (state.tag === 'loading') {
  //     z3_status_container.append('Loading Z3...')
  //     generate_button.disabled = true
  //   } else if (state.tag === 'ready') {
  //     z3_is_ready(state.ctx)
  //     set_all_constraints(constraint_block.get_output())
  //   } else if (state.tag === 'error') {
  //     z3_status_container.append(state.message)
  //     z3_status_container.style.color = 'red'
  //     if (state.message === 'Out of memory') {
  //       z3_status_container.append('.  Try closing and re-opening the tab or window.')
  //     }
  //     generate_button.disabled = true
  //   } else {
  //     throw new Error('')
  //   }
  // }).call()

  // const z3_is_ready = (ctx: Context) => {
  //   generate_button.addEventListener('click', async () => {
  //     const constraints = assert_exists(constraint_block.get_output(), 'Generate button clicked but not all constraints ready!')
  //     await model_finder.start_search(ctx, constraints, is_regular.get())
  //   })
  // }

  return el('div', {},
    mi.element,
    // el('div', { class: 'model-input' },
    //   mi.element,
    //   generate_line,
    //   regular_toggle,
    // ),
    model_finder.element,
  )
}

if (!hasMathMLSupport()) {
  alert('No mathML support :(')
  throw new Error('No mathML support :(')
}

root.appendChild(main())
