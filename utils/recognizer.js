/**
 * 本地类型识别引擎
 * 纯正则匹配，不联网，识别剪贴板内容的初步类型
 */

const RULES = [
  { type: 'password', label: '密码/凭证', regex: /(password|secret|token|key|api.?key|access.?key)/i, priority: 1 },
  { type: 'email', label: '邮箱', regex: /^[\w.\-+]+@[\w.\-]+\.\w{2,}$/, priority: 2 },
  { type: 'phone', label: '手机号', regex: /^1[3-9]\d{9}$/, priority: 2 },
  { type: 'idcard', label: '身份证', regex: /^\d{17}[\dXx]$/, priority: 2 },
  { type: 'bankcard', label: '银行卡', regex: /^\d{16,19}$/, priority: 3 },
  { type: 'url', label: '链接', regex: /^https?:\/\/.+/, priority: 3 },
  { type: 'address', label: '地址', regex: /(省|市|区|县|路|街|号|栋|楼|室)/, priority: 4 },
  { type: 'ip', label: 'IP地址', regex: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, priority: 4 },
]

const TYPE_CONFIG = {
  password:  { icon: '🔑', color: '#E74C3C' },
  email:     { icon: '📧', color: '#8E44AD' },
  phone:     { icon: '📱', color: '#1ABC9C' },
  idcard:    { icon: '🪪', color: '#E67E22' },
  bankcard:  { icon: '💳', color: '#F39C12' },
  url:       { icon: '🔗', color: '#27AE60' },
  address:   { icon: '📍', color: '#3498DB' },
  ip:        { icon: '🌐', color: '#2C3E50' },
  text:      { icon: '💬', color: '#95A5A6' },
}

/**
 * 识别内容类型
 * @param {string} content 剪贴板文本
 * @returns {{ type: string, label: string, icon: string, color: string }}
 */
function recognize(content) {
  if (!content || typeof content !== 'string') {
    return { ...TYPE_CONFIG.text, type: 'text', label: '文本' }
  }

  const trimmed = content.trim()

  // 多行文本且含编程特征 → 代码
  if (trimmed.includes('\n') && /[{}\[\];=><]/.test(trimmed)) {
    return { type: 'code', label: '代码', icon: '💻', color: '#27AE60' }
  }

  // 按优先级匹配
  let best = null
  for (const rule of RULES) {
    const text = rule.type === 'address' ? trimmed : trimmed.replace(/\s/g, '')
    if (rule.regex.test(text)) {
      if (!best || rule.priority < best.priority) {
        best = { ...TYPE_CONFIG[rule.type], type: rule.type, label: rule.label, _priority: rule.priority }
      }
    }
  }

  if (best) {
    delete best._priority
    return best
  }

  return { ...TYPE_CONFIG.text, type: 'text', label: '文本' }
}

/**
 * 判断是否为敏感类型（应仅本地处理，不上传）
 */
function isSensitive(type) {
  return ['password', 'idcard', 'bankcard'].includes(type)
}

export default { recognize, isSensitive, TYPE_CONFIG }
