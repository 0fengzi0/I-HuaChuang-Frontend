import { expect, test } from '@playwright/test'

test('loads the demo studio and main routes', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/studio$/)
  await expect(page.getByRole('link', { name: 'I画创工作台' })).toBeVisible()
  await expect(page.locator('.workspace')).toHaveCount(0)

  await page.locator('textarea').first().fill('蓝橙油墨在暖白色光桌上扩散')
  const generateButton = page
    .locator('button:visible')
    .filter({ hasText: '开始生成' })
    .first()
  await expect(generateButton).toBeEnabled()
  await generateButton.evaluate((button: HTMLElement) => button.click())
  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.getByText('你的画面完成了')).toBeVisible({ timeout: 12_000 })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  const stageBox = await page.locator('.workspace').boundingBox()
  const editorBox = await page.locator('.compact-editor').boundingBox()
  expect(stageBox).not.toBeNull()
  expect(editorBox).not.toBeNull()
  expect(stageBox!.y).toBeLessThan(editorBox!.y)
  expect(editorBox!.height).toBeLessThanOrEqual(72)
  await expect(page.locator('.control-rail')).toHaveCount(0)

  await page.getByRole('button', { name: '新生成' }).click()
  await expect(page.locator('.workspace')).toHaveCount(0)
  await expect(page.locator('textarea').first()).toHaveValue('')

  await page.getByRole('button', { name: '打开最近作品' }).click()
  const recentDialog = page.getByRole('dialog')
  await expect(recentDialog).toContainText('最近作品')
  await recentDialog.getByRole('button', { name: '关闭最近作品' }).click()

  for (const [hash, text] of [
    ['#/history', '历史作品'],
    ['#/wallet', '积分与卡密'],
    ['#/admin', '管理后台'],
  ]) {
    await page.goto(hash)
    await expect(page.locator('body')).toContainText(text, {
      timeout: 15_000,
    })
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
