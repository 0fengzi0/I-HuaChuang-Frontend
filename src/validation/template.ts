export interface ValidationContext {
  form: Record<string, unknown>
}

export const MAX_TEMPLATE_TITLE = 40
export const MAX_TEMPLATE_DESCRIPTION = 200
export const MAX_TEMPLATE_PROMPT = 2000
export const MAX_TEMPLATE_VARIABLES = 8

const variableNamePattern = /^[\p{L}\p{N}_]{1,20}$/u
const variableGroupPattern = /\{([^{}]*)\}/g

// parseTemplateVariables mirrors the backend parser: `{变量}` placeholders are
// extracted in first-appearance order and deduplicated; unpaired braces or
// invalid names make the prompt invalid.
export function parseTemplateVariables(prompt: string): string[] {
  const groups = prompt.matchAll(variableGroupPattern)
  const residue = prompt.replace(variableGroupPattern, '')
  if (/[{}]/.test(residue)) {
    throw new TemplatePromptError('提示词中的大括号不配对，请检查 {变量} 写法。')
  }
  const seen = new Set<string>()
  const names: string[] = []
  for (const match of groups) {
    const name = match[1]?.trim() ?? ''
    if (!variableNamePattern.test(name)) {
      throw new TemplatePromptError(
        '提示词中的 {…} 不是有效变量名，变量名只能使用中文、字母、数字或下划线（1-20 个字）。',
      )
    }
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  if (names.length > MAX_TEMPLATE_VARIABLES) {
    throw new TemplatePromptError('变量数量不能超过 8 个。')
  }
  return names
}

export function composeTemplatePrompt(
  prompt: string,
  variables: string[],
  values: Record<string, string>,
): string {
  let result = prompt
  for (const name of variables) {
    result = result.replaceAll(`{${name}}`, values[name]?.trim() ?? '')
  }
  return result
}

export class TemplatePromptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplatePromptError'
  }
}

export const templateFormSchema = {
  title(value: unknown) {
    const text = String(value ?? '').trim()
    if (text.length < 1 || text.length > MAX_TEMPLATE_TITLE) {
      return '标题需为 1-40 个字。'
    }
    return true
  },
  description(value: unknown) {
    if (String(value ?? '').trim().length > MAX_TEMPLATE_DESCRIPTION) {
      return '描述不能超过 200 个字。'
    }
    return true
  },
  prompt(value: unknown) {
    const text = String(value ?? '')
    if (text.trim().length < 1) {
      return '请输入提示词。'
    }
    if (text.length > MAX_TEMPLATE_PROMPT) {
      return '提示词需为 1-2000 个字。'
    }
    try {
      parseTemplateVariables(text)
    } catch (error) {
      return error instanceof TemplatePromptError ? error.message : '提示词格式不正确。'
    }
    return true
  },
}

export const templateCategorySchema = {
  name(value: unknown) {
    const text = String(value ?? '').trim()
    if (text.length < 1 || text.length > 20) {
      return '分类名需为 1-20 个字。'
    }
    return true
  },
}
