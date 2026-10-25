import { expect, test } from '@playwright/test'

test('loads the demo studio and main routes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect(page).toHaveURL(/#\/studio$/)
  await expect(page.getByRole('link', { name: 'I画创工作台' })).toBeVisible()
  await expect(page.locator('.workspace')).toHaveCount(0)

  await page.locator('textarea').first().fill('蓝橙油墨在暖白色光桌上扩散')
  const generateButton = page.locator('.prompt-generate')
  await expect(generateButton).toContainText('开始生成')
  await expect(generateButton).toBeEnabled()
  await page.locator('.prompt-card').evaluate((element) => {
    ;(window as Window & { __studioEditor?: Element }).__studioEditor = element
  })
  const launchSnapshot = await page.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>('.prompt-generate')
    button?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return {
      className: button?.className ?? '',
      text: button?.textContent ?? '',
      animationName: button ? getComputedStyle(button).animationName : '',
    }
  })
  expect(launchSnapshot.className).toContain('is-launching')
  expect(launchSnapshot.text).toContain('正在准备画布')
  expect(launchSnapshot.animationName).toContain('generate-action-press')
  await expect(page.locator('.workspace')).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __studioEditor?: Element }).__studioEditor ===
        document.querySelector('.prompt-card'),
    ),
  ).toBe(true)
  await expect(page.getByText('你的画面完成了')).toBeVisible({ timeout: 12_000 })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  const stageBox = await page.locator('.workspace').boundingBox()
  const editorBox = await page.locator('.compact-editor').boundingBox()
  expect(stageBox).not.toBeNull()
  expect(editorBox).not.toBeNull()
  expect(stageBox!.y).toBeLessThan(editorBox!.y)
  expect(editorBox!.height).toBeLessThanOrEqual(72)
  await expect(page.locator('.control-rail')).toBeVisible()
  await expect(page.locator('.prompt-card')).toHaveClass(/compact-editor/)
  await expect(page.getByText('调整下一张')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /生成另一张/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /再画一张/ })).toHaveCount(0)

  await page.getByRole('button', { name: '重新创作，清空当前内容' }).click()
  await expect(page.locator('.workspace')).toHaveCount(0)
  await expect(page.locator('textarea').first()).toHaveValue('')
  await expect(page.locator('.detail-settings select')).toHaveCount(2)
  const ratioOption = page.locator('.quick-settings select option[value="9:16"]')
  expect(await ratioOption.textContent()).toContain('抖音常用')

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
