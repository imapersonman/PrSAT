import { CONSTRAINT_INPUT_INSTRUCTIONS, DEFAULT_DEBOUNCE_MS, INFO_MESSAGE_EMPTY, INFO_MESSAGE_ERROR, INFO_MESSAGE_OKAY } from "./constants";
import { debounce } from "./debounce";
import { BatchInputLogic, InputBlockLogic, SingleInputLogic } from "./display_logic";
import { el, tel } from "./el";
import { assert, assert_exists, fallthrough } from "./utils";
import { Editable } from "./editable";
import { download } from "./download";
import * as TestId from '../tests/test_ids'

import './style.css'
import { TestIdGenerator } from "../tests/test_ids";

// const root = assert_exists(document.getElementById('app'))

export type InputBlock = {
  element: HTMLElement
  set_fields: (fields: string[]) => void
}

export type SplitInput = {
  element: HTMLElement
  set_cursor: (position: number) => void
}

const make_hideable = (view: HTMLElement, hidden: Editable<boolean>): void => {
  const original_display = view.style.display
  hidden.watch((is_hidden) => {
    if (is_hidden) {
      view.style.display = 'none'
    } else {
      view.style.display = original_display
    }
  }).call()
}

export const split_input = <ParseOutput extends {}>(
  logic: SingleInputLogic<ParseOutput, SplitInput>,
  display: (output: ParseOutput) => Element,
  placeholder_text: string,
  test_id_gen: TestIdGenerator,
): SplitInput => {
  const delete_button = tel(TestId.single_input.close, 'input', { type: 'button', value: '⌫', class: 'close' }) as HTMLButtonElement
  const newline_button = tel(TestId.single_input.newline, 'input', { type: 'button', value: '⏎', class: 'newline' }) as HTMLButtonElement
  const info_button = el('input', { type: 'button' }) as HTMLButtonElement
  const textbox = tel(TestId.single_input.input, 'input', { type: 'input', style: `width: ${placeholder_text.length}ch`, placeholder: placeholder_text, class: 'text' }) as HTMLInputElement
  const output_container = el('span', {})
  const error_info_container = el('div', { class: 'error', style: 'margin-bottom: 0.4em;' }, 'error!')
  const info_container = el('div', { class: 'input-instructions' }, error_info_container, CONSTRAINT_INPUT_INSTRUCTIONS)
  const element = tel(test_id_gen.gen(), 'div', { class: 'single-input' },
    delete_button,
    textbox,
    newline_button,
    info_button,
    output_container,
    info_container)

  const remove = (): boolean => {
    const start_pos = textbox.selectionStart
    const end_pos = textbox.selectionEnd
    if (start_pos === 0 && end_pos === 0) {
      // using textbox.value and not logic.text.get() because the latter might be out of date.
      const replacement = logic.remove()
      if (replacement !== undefined) {
        const old_replacement_line_length = replacement.text.get().length
        replacement.text.set(`${replacement.text.get()}${textbox.value}`)
        replacement.set_focused()
        replacement.associate.set_cursor(old_replacement_line_length)
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }

  const split_at_position = (text: string, position: number): [string, string] => {
    return [
      text.substring(0, position),
      text.substring(position),
    ]
  }

  const hide_info = new Editable(true)
  make_hideable(info_container, hide_info)
  info_button.onclick = (event) => {
    hide_info.set(!hide_info.get())
    event.stopPropagation()
  }

  textbox.onkeydown = (event) => {
    if (event.key === 'Enter') {
      const cursor_position = assert_exists(textbox.selectionEnd, 'While trying to get cursor position, ArrowUp event called when textbox not focused')
      const [first_part, second_part] = split_at_position(textbox.value, cursor_position)  // using textbox value because text might be out of date because of debouncing!
      console.log(first_part, second_part)
      const next = logic.then_insert()
      next.text.set(second_part)
      logic.text.set(first_part)
      next.associate.set_cursor(0)
      next.set_focused()
      event.preventDefault()
    } else if (event.key === 'ArrowUp') {
      const cursor_position = assert_exists(textbox.selectionEnd, 'While trying to get cursor position, ArrowUp event called when textbox not focused')
      const p = logic.focus_previous()
      p?.associate.set_cursor(cursor_position)
      event.preventDefault()
    } else if (event.key === 'ArrowDown') {
      const cursor_position = assert_exists(textbox.selectionEnd, 'While trying to get cursor position, ArrowUp event called when textbox not focused')
      const n = logic.focus_next()
      n?.associate.set_cursor(cursor_position)
      event.preventDefault()
    } else if (event.key === 'Backspace') {
      if (remove()) {
        event.preventDefault()
      }
    }
  }

  delete_button.onclick = () => {
    logic.remove()
  }

  newline_button.onclick = () => {
    logic.then_insert()
  }

  logic.has_siblings.watch((has_siblings) => {
    delete_button.disabled = !has_siblings
  })

  logic.on_state_change((state) => {
    output_container.innerHTML = ''
    output_container.style.display = 'none'
    error_info_container.innerHTML = ''

    if (state.tag === 'parsed') {
      const output_element = display(state.output)
      output_container.appendChild(output_element)
      output_container.style.display = 'inline'
      info_button.value = INFO_MESSAGE_OKAY
      info_button.classList.remove('error')
    } else if (state.tag === 'error') {
      info_button.value = INFO_MESSAGE_ERROR
      info_button.classList.add('error')
      error_info_container.append(state.message)
    } else if (state.tag === 'nothing') {
      info_button.value = INFO_MESSAGE_EMPTY
      info_button.classList.remove('error')
    } else {
      fallthrough('split_input.logic.on_state_change', state)
    }
  }).call()

  textbox.addEventListener('input', debounce(DEFAULT_DEBOUNCE_MS, {
    lead: () => output_container.classList.add('updating'),
    trail: () => {
      output_container.classList.remove('updating')
      logic.text.set(textbox.value)
    },
  }))

  textbox.addEventListener('input', () => {
    if (textbox.value.length < placeholder_text.length) {
      textbox.style.width = `${placeholder_text.length}ch`
    } else {
      textbox.style.width = `${textbox.value.length}ch`
    }
  })

  logic.text.watch((text) => {
    textbox.value = text
    if (textbox.value.length < placeholder_text.length) {
      textbox.style.width = `${placeholder_text.length}ch`
    } else {
      textbox.style.width = `${textbox.value.length}ch`
    }
  })

  textbox.onfocus = () => {
    element.classList.add('focused')
  }

  textbox.onblur = () => {
    element.classList.remove('focused')
  }

  logic.on_focus((is_focused) => {
    if (is_focused) {
      textbox.focus()
    } else {
      textbox.blur()
    }
  })

  element.onclick = () => {
    logic.set_focused()
  }

  const set_cursor = (position: number): void => {
    if (position < 0) {
      textbox.setSelectionRange(textbox.value.length, textbox.value.length)
    } else {
      textbox.setSelectionRange(position, position)
    }
  }

  // const refresh_display = () => {
  //   logic.text.set(textbox.value)
  // }

  return {
    element,
    set_cursor,
  }
}

const split_input_block = <ParseOutput extends {}>(
  block_logic: InputBlockLogic<ParseOutput, SplitInput>,
  // display: (output: ParseOutput) => Element,
): InputBlock => {
  const split_inputs_container = el('div', {})
  const parent = el('div', { class: 'split-input-block' }, split_inputs_container)

  block_logic.on_insert((to_insert, lead) => {
    if (lead === undefined) {
      split_inputs_container.insertAdjacentElement('afterbegin', to_insert.associate.element)
    } else {
      lead.associate.element.insertAdjacentElement('afterend', to_insert.associate.element)
    }
  })

  block_logic.on_remove((to_remove) => {
    to_remove.associate.element.remove()
  })

  block_logic.insert_input_after(undefined)

  return {
    element: parent,
    set_fields: (fields) => block_logic.set_fields(fields),
  }
}

const batch_input_block = <ParseOutput extends {}>(
  batch_logic: BatchInputLogic<ParseOutput, SplitInput>,
  placeholder_text: string,
): InputBlock => {
  const textbox = el('textarea', { placeholder: placeholder_text, style: 'display: block; border-radius: 0.4em;', rows: '10', cols: '50' }) as HTMLTextAreaElement
  const parse_button = button('⇩ Parse', { style: 'margin-right: 0.4em;' })

  parse_button.onclick = () => {
    batch_logic.send()
    batch_logic.text.set('')
    textbox.value = ''
  }

  textbox.addEventListener('input', debounce(DEFAULT_DEBOUNCE_MS, {
    trail: () => {
      console.log('update')
      batch_logic.text.set(textbox.value)
    },
  }))

  const element = el('div', { class: 'batch-input', style: 'width: fit-content;' },
    textbox,
    el('span', { style: 'display: flex; margin-top: 0.4em;' },
      parse_button,
      // sync_status_container,
    ),
  )
  return {
    element,
    set_fields: (fields) => {
      batch_logic.text.set(fields.join('\n'))
    },
  }
}

const button = (label: string, attrs: Record<string, string> = {}): HTMLButtonElement => {
  return el('input', { ...attrs, type: 'button', value: label }) as HTMLButtonElement
}

export const generic_input_block = <ParseOutput extends {}>(
  block: InputBlockLogic<ParseOutput, SplitInput>,
  batch_placeholder_text: string,
): InputBlock => {
  const batch_logic = new BatchInputLogic(block)
  const batch_block = batch_input_block(batch_logic, batch_placeholder_text)
  const split_block = split_input_block(block)

  const file_loader = el('input', { type: 'file', style: 'display: none;' }) as HTMLInputElement
  const load_button = button('Load From File', { style: 'margin-right: 0.4em;' })
  const save_button = button('Save to File')
  const copy_button = button('Copy to Clipboard', { style: 'margin-left: 0.4em;' })
  const copy_message_container = el('span', { style: 'margin-left: 0.4em;', class: 'copy-message' }, 'Copied Constraints!')
  const show_batch_button = button('')

  const show_batch_block = new Editable(true)
  make_hideable(batch_block.element, show_batch_block)
  show_batch_button.onclick = () => {
    show_batch_block.set(!show_batch_block.get())
  }
  show_batch_block.watch((show) => {
    if (show) {
      show_batch_button.value = 'Show Batch Input'
    } else {
      show_batch_button.value = 'Hide Batch Input'
    }
  }).call()

  load_button.onclick = () => {
    file_loader.click()
  }

  save_button.onclick = () => {
    const combined_fields = block.get_fields().join('\n')
    download(combined_fields, 'constraints.txt', 'text/plain')
  }

  let copy_message_animation_timer: ReturnType<typeof setTimeout> | undefined = undefined
  copy_button.onclick = async () => {
    await navigator.clipboard.writeText(batch_logic.text.get())
    copy_message_container.classList.add('show')
    copy_button.disabled = true
    copy_message_animation_timer = setTimeout(() => {
      copy_message_container.classList.remove('show')
      copy_button.disabled = false
      clearTimeout(copy_message_animation_timer)
    }, 800)  // This value needs to align with animation-duration in .copy-message.show!
  }

  file_loader.onchange = async () => {
    const files = assert_exists(file_loader.files, 'file_loader.files is null!')
    assert(files.length === 1, `Number of files in file_loader != 1!\nactually: ${files.length}`)
    const f = assert_exists(files[0], 'files[0] is null!')
    batch_logic.text.set(await f.text())
    batch_logic.send()
  }

  const element = el('div', { class: 'generic-input-block' },
    file_loader,
    el('div', { style: 'width: fit-content;' },
      el('div', { style: 'margin-bottom: 0.4em;' },
        load_button,
        show_batch_button,
      ),
      batch_block.element,
    ),
    split_block.element,
    el('div', { style: 'margin-top: 0.4em;' },
      save_button,
      el('span', {}, copy_button, copy_message_container)),
  )
  return {
    element,
    set_fields: (fields) => {
      batch_block.set_fields(fields)
      split_block.set_fields(fields)
    },
  }
}

// type Constraint = PrSat['Constraint']
// const block_logic = new InputBlockLogic<Constraint, SplitInput>(
//   parse_constraint,
//   (logic) => split_input(logic, constraint_to_html, CONSTRAINT_INPUT_PLACEHOLDER))

// const generic_block = generic_input_block(block_logic, BATCH_CONSTRAINT_INPUT_PLACEHOLDER)
// root.append(generic_block.element)
