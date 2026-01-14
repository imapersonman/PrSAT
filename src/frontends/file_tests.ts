import { el } from "../el";
import { assert_exists } from "../utils";
import FF from '../fitelson_files/outputs/probability_table_generator_inputs_2'
import { generate_constraint_sets } from "../fitelson_files/stuff";
import { constraint_to_html } from "../prsat_to_html";
import { assert_parse_constraint } from "../parser";

import '../style.css'
import { button } from "./common";
import { SolverStateMachine } from "../solver";
import { BaseSolver } from "../solver/basic";
import { WebWorkerSolver } from "../solver/ww-solver";

const root = assert_exists(document.getElementById('app'), 'Root element with id \'#app\' doesn\'t exist!')
const solver = new BaseSolver()
// const solver = new WebWorkerSolver()
const machine = new SolverStateMachine(solver)
await machine.as('uninitialized').initialize()

try {
  for (const cs of generate_constraint_sets(FF)) {
    const parsed_cs = cs.constraints.map(assert_parse_constraint)
    const display_cs = parsed_cs.map((c) => constraint_to_html(c, true))
    
    const comments = el('div', { style: 'margin-bottom: 0.4em;' })
    const block = el('div', { class: 'generic-input-block', style: 'margin-bottom: 0.4em; overflow-x: auto;' }, comments)

    for (const c of cs.description) {
      const e = el('div', {}, c)
      comments.appendChild(e)
    }

    for (const [index, dc] of display_cs.entries()) {
      const attrs: Record<string, string> = index === 0 ? {} : { style: 'margin-top: 0.4em;' }
      const container = el('div', attrs, dc)
      block.appendChild(container)
    }

    const cancel_button = button('Cancel') as HTMLInputElement
    cancel_button.disabled = true
    cancel_button.addEventListener('click', () => {
      machine.as('solving').solver.cancel()
    })

    const regular_checkbox = el('input', { type: 'checkbox' }) as HTMLInputElement
    block.appendChild(regular_checkbox)
    if (cs.regular) {
      // regular_checkbox.click()
      regular_checkbox.checked = true
    }

    const go_button = button('Go', { style: 'margin-top: 0.4em;' })
    go_button.addEventListener('click', async () => {
      const is_regular = regular_checkbox.checked
      await machine.as('initialized', 'invalidated').start(parsed_cs, is_regular)
      machine.as('staged').go()

      cancel_button.disabled = false
      const result = await machine.as('solving').solver.wait()
      cancel_button.disabled = true
      console.log('result!', result)
      machine.as('finished').invalidate()
    })

    block.appendChild(go_button)
    block.appendChild(cancel_button)
    root.appendChild(block)
  }
} catch (e: any) {
  console.error(e)
  alert('check the console you messed up.')
}

root.appendChild(el('div', {}, 'Hello, files!'))
