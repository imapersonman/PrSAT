export type TestIdGenerator = { prefix: string, gen: () => string, get: (index: number) => string }

const test_id_generator = (prefix: string): TestIdGenerator => {
  let current = 0
  return {
    prefix,
    gen: () => { console.log("ahsdladhjasldhualkjdn"); return `${prefix}-${current++}` },
    get: (index: number) => `${prefix}-${index}`,
  }
}

const readonly = <T extends {}>(t: T): Readonly<T> => {
  return t
}

export const z3_status = 'z3-status'
// export const single_input = test_id_generator('single-input')
export const find_model = 'find-model'
export const regular_toggle = 'regular-toggle'
export const model_table = 'model-table'

export const single_input = readonly({
  constraint: test_id_generator('single-input-constraint'),
  eval: test_id_generator('single-input-eval'),
  close: 'close',
  input: 'input',
  newline: 'newline',
})

export const mode_select_id = 'mode-select'
export const mode_select_button = (prefix: string, option: string): string => `${prefix}-${mode_select_id}-${option}`

export const state_row = readonly({
  state: (index: number) => `state-a${index}`,
  value: (index: number) => `state-value-${index}`,
})

// export const constraint_multi_view = readonly({
//   id: 'constraint-group-input-Multi',
// })
// export const constraint_batch_view = readonly({
//   id: 'constraint-group-input-Batch',
//   textbox: 'group-input-Batch-textbox',
// })
// export const eval_multi_view = readonly({
//   id: 'eval-group-input-Multi',
// })
// export const eval_batch_view = readonly({
//   id: 'eval-group-input-Batch',
//   textbox: 'eval-group-input-Batch-textbox',
// })

export type GenericMultiInputTestIds = {
  id: string
  multi: Readonly<{
    id: string
  }>
  batch: Readonly<{
    id: string
    textbox: string
  }>
}

export const generic_multi_input = (prefix: 'constraints' | 'eval'): GenericMultiInputTestIds => {
  const id = prefix
  return {
    id,
    multi: readonly({
      mode: `${id}-mode-multi`,
      id: `${id}-multi-parent`,
    }),
    batch: readonly({
      id: `${id}-batch-parent`,
      textbox: `${id}-batch-textbox`,
    }),
  }
}
