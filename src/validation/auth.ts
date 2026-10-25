interface ValidationContext {
  form: Record<string, unknown>
}

const usernamePattern = /^[\p{L}\p{N}_-]{3,24}$/u
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const loginValidationSchema = {
  identifier(value: unknown) {
    if (!String(value ?? '').trim()) {
      return '请输入用户名或邮箱。'
    }
    return true
  },
  password(value: unknown) {
    if (!value) {
      return '请输入密码。'
    }
    return true
  },
}

export const registerValidationSchema = {
  username(value: unknown) {
    if (!usernamePattern.test(String(value ?? '').trim())) {
      return '用户名需为 3 到 24 个字符，可使用文字、数字、下划线或短横线。'
    }
    return true
  },
  email(value: unknown) {
    if (!emailPattern.test(String(value ?? '').trim())) {
      return '请输入有效的邮箱地址。'
    }
    return true
  },
  password(value: unknown) {
    const password = String(value ?? '')
    if (password.length < 8) {
      return '密码至少需要 8 个字符。'
    }
    if (password.length > 72) {
      return '密码不能超过 72 个字符。'
    }
    return true
  },
  confirmPassword(value: unknown, ctx: ValidationContext) {
    if (!value) {
      return '请再次输入密码。'
    }
    if (value !== ctx.form.password) {
      return '两次输入的密码不一致。'
    }
    return true
  },
  captchaAnswer(value: unknown) {
    if (!/^[A-Za-z0-9]{4}$/.test(String(value ?? ''))) {
      return '请输入 4 位图形验证码。'
    }
    return true
  },
  termsAccepted(value: unknown) {
    if (!value) {
      return '请先同意用户协议与隐私政策。'
    }
    return true
  },
}
