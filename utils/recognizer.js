/**
 * 本地类型识别引擎
 * 当前版本：本地不做识别，全部默认为未知文本类型
 */

const STORAGE_KEY = 'clip_custom_types'

const PRESET_TYPES = {
  phone:    { label: '手机号', color: '#1ABC9C' },
  text:     { label: '未知文本', color: '#95A5A6' },
  url:      { label: '链接', color: '#27AE60' },
  password: { label: '密码', color: '#E74C3C' },
}

const CUSTOM_COLORS = ['#8E44AD', '#E67E22', '#F39C12', '#3498DB', '#2C3E50', '#E74C3C', '#1ABC9C', '#27AE60']

let customTypes = null
let _onChange = null

function ensureLoaded() {
  if (customTypes === null) {
    try {
      const data = uni.getStorageSync(STORAGE_KEY)
      customTypes = data ? JSON.parse(data) : {}
    } catch (e) {
      customTypes = {}
    }
  }
}

/**
 * 注册变更回调（Vue 侧用于 $forceUpdate）
 */
function onChange(fn) {
  _onChange = fn
}

function saveCustomTypes() {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(customTypes))
  } catch (e) {
    console.error('保存自定义类型失败:', e)
  }
}

/**
 * 获取所有类型（预设 + 自定义）
 */
function getAllTypes() {
  ensureLoaded()
  return { ...PRESET_TYPES, ...customTypes }
}

/**
 * 添加自定义类型
 * @param {string} label 类型名称
 * @param {string} color 颜色（可选，自动分配）
 * @returns {{ key: string, label: string, color: string }}
 */
function addCustomType(label, color) {
  ensureLoaded()
  const key = 'custom_' + Date.now()
  const assignedColor = color || CUSTOM_COLORS[Object.keys(customTypes).length % CUSTOM_COLORS.length]
  customTypes[key] = { label, color: assignedColor, custom: true }
  saveCustomTypes()
  _onChange && _onChange()
  return { key, label, color: assignedColor, custom: true }
}

/**
 * 删除自定义类型
 * @param {string} key 类型key
 */
function deleteCustomType(key) {
  ensureLoaded()
  delete customTypes[key]
  saveCustomTypes()
  _onChange && _onChange()
}

/**
 * 识别内容类型（当前全部返回未知文本）
 */
function recognize(content) {
  return { type: 'text', label: '未知文本', color: '#95A5A6' }
}

/**
 * 判断是否为敏感类型（应仅本地处理，不上传）
 */
function isSensitive(type) {
  return ['password'].includes(type)
}

export default { recognize, isSensitive, getAllTypes, addCustomType, deleteCustomType, onChange }
