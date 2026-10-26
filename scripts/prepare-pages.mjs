import { cp, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(scriptDirectory, '..')
const sourceDirectory = resolve(projectDirectory, 'dist')
const targetDirectory = resolve(projectDirectory, '_site')
const apiBaseUrl = 'https://api.img.5ixf.com'

await rm(targetDirectory, { recursive: true, force: true })
await cp(sourceDirectory, targetDirectory, { recursive: true })
await writeFile(
  resolve(targetDirectory, 'config.js'),
  [
    'window.__IHUACHUANG_CONFIG__ = {',
    `  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},`,
    '  demoMode: false,',
    '}',
    '',
  ].join('\n'),
  'utf8',
)
