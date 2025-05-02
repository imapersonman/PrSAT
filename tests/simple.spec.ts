import { test, expect, Page, Locator } from '@playwright/test'
import * as TestId from './test_ids'

const URL = 'http://localhost:5173/'
const DEFAULT_TIMEOUT = 20_000

const to_load = async (page: Page): Promise<void> => {
  await page.goto(URL)
  await expect(page.getByTestId(TestId.z3_status)).toBeEmpty({ timeout: DEFAULT_TIMEOUT })
}

test('single constraint', async ({ page }) => {
  await to_load(page)

  const single_input = page.getByTestId(TestId.single_input.constraint.get(0))
  await single_input.getByTestId(TestId.single_input.input).fill('Pr(A & B) = Pr(A) * Pr(B)')
  await page.getByTestId(TestId.find_model).click()
  await page.getByTestId(TestId.regular_toggle).check()
  await page.getByTestId(TestId.find_model).click()

  await expect(page.getByTestId(TestId.model_table)).toBeVisible({ timeout: DEFAULT_TIMEOUT })
});

test('adding a bunch of constraints', async ({ page }) => {
  await to_load(page)

  const n_constraints = 10
  for (let cindex = 0; cindex < n_constraints; cindex++) {
    const si = page.getByTestId(TestId.single_input.constraint.get(cindex))
    await expect(si).toBeVisible()
    await si.getByTestId(TestId.single_input.newline).click()
  }

  const si = page.getByTestId(TestId.single_input.constraint.get(n_constraints - 1))
  await expect(si).toBeVisible()
})

test('adding then removing a bunch of constraints', async ({ page }) => {
  await to_load(page)

  const n_constraints = 10
  for (let cindex = 0; cindex < n_constraints; cindex++) {
    const si = page.getByTestId(TestId.single_input.constraint.get(cindex))
    await expect(si).toBeVisible()
    await si.getByTestId(TestId.single_input.newline).click()
  }

  const si = page.getByTestId(TestId.single_input.constraint.get(n_constraints - 1))
  await expect(si).toBeVisible()

  for (let cindex = 0; cindex < n_constraints; cindex++) {
    const si = page.getByTestId(TestId.single_input.constraint.get(cindex))
    await expect(si).toBeVisible()
    await si.getByTestId(TestId.single_input.close).click()
    await expect(si).not.toBeVisible()
  }
})

test('multiple constraints', async ({ page }) => {
  await to_load(page)
  const single_inputs: Locator[] = []

  single_inputs.push(page.getByTestId(TestId.single_input.constraint.get(0)))
  await expect(single_inputs[0]).toBeVisible()
  await single_inputs[0].getByTestId(TestId.single_input.input).fill('Pr(A & B & C) = Pr(A) * Pr(B) * Pr(C)')
  await single_inputs[0].getByTestId(TestId.single_input.newline).click()

  single_inputs.push(page.getByTestId(TestId.single_input.constraint.get(1)))
  await expect(single_inputs[1]).toBeVisible()
  await single_inputs[1].getByTestId(TestId.single_input.input).fill('Pr(A & B) = Pr(A) * Pr(B)')
  await single_inputs[1].getByTestId(TestId.single_input.newline).click()

  single_inputs.push(page.getByTestId(TestId.single_input.constraint.get(2)))
  await expect(single_inputs[2]).toBeVisible()
  await single_inputs[2].getByTestId(TestId.single_input.input).fill('Pr(A & C) = Pr(A) * Pr(C)')
  await single_inputs[2].getByTestId(TestId.single_input.newline).click()

  single_inputs.push(page.getByTestId(TestId.single_input.constraint.get(3)))
  await expect(single_inputs[3]).toBeVisible()
  await single_inputs[3].getByTestId(TestId.single_input.input).fill('Pr(B & C) = Pr(B) * Pr(C)')

  await page.getByTestId(TestId.find_model).click()
  await expect(page.getByTestId(TestId.model_table)).toBeVisible({ timeout: DEFAULT_TIMEOUT })
})
