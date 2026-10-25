import { describe, expect, it } from 'vitest'
import { loginValidationSchema, registerValidationSchema } from '../src/validation/auth'

describe('authentication validation', () => {
  it('requires login credentials', () => {
    expect(loginValidationSchema.identifier('  ')).toBe('请输入用户名或邮箱。')
    expect(loginValidationSchema.identifier(' demo ')).toBe(true)
    expect(loginValidationSchema.password('')).toBe('请输入密码。')
    expect(loginValidationSchema.password('secret')).toBe(true)
  })

  it('validates registration fields', () => {
    expect(registerValidationSchema.username('用户_01')).toBe(true)
    expect(registerValidationSchema.username('x')).toContain('3 到 24')
    expect(registerValidationSchema.email('demo@example.com')).toBe(true)
    expect(registerValidationSchema.email('invalid')).toBe('请输入有效的邮箱地址。')
    expect(registerValidationSchema.password('short')).toContain('至少需要 8')
    expect(registerValidationSchema.password('x'.repeat(73))).toContain('不能超过 72')
    expect(registerValidationSchema.password('password123')).toBe(true)
    expect(
      registerValidationSchema.confirmPassword('different', {
        form: { password: 'password123' },
      }),
    ).toBe('两次输入的密码不一致。')
    expect(
      registerValidationSchema.confirmPassword('password123', {
        form: { password: 'password123' },
      }),
    ).toBe(true)
    expect(registerValidationSchema.captchaAnswer('A1B2')).toBe(true)
    expect(registerValidationSchema.captchaAnswer('12')).toContain('4 位')
    expect(registerValidationSchema.termsAccepted(true)).toBe(true)
    expect(registerValidationSchema.termsAccepted(false)).toContain('同意')
  })
})
