import { el, tel } from "../el"

export const button = (label: string, attrs: Record<string, string> = {}, test_id?: string): HTMLButtonElement => {
  if (test_id === undefined) {
    return el('input', { ...attrs, type: 'button', value: label }) as HTMLButtonElement
  } else {
    return tel(test_id, 'input', { ...attrs, type: 'button', value: label }) as HTMLButtonElement
  }
}
