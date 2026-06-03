/**
 * 本地类型识别引擎
 * 当前版本：本地不做识别，全部默认为未知文本类型
 */

const STORAGE_KEY = 'clip_custom_types'

const PRESET_TYPES = {
  text:  { label: '未知文本', color: '#95A5A6' },
  image: { label: '图片', color: '#E67E22' },
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
 * 按媒体类型获取可选类型
 * 图片仅可选 image 类型；文字可选除 image 外的所有类型
 * @param {string} mediaType 'text' | 'image'
 * @param {string} currentType 当前已分配的类型 key（即使不匹配 mediaType 也会保留）
 */
function getTypesForMediaType(mediaType, currentType) {
  const all = getAllTypes()
  if (mediaType === 'image') {
    const result = { image: all.image }
    // 保留当前类型（即使是文字类型，也让它可被选择以改回）
    if (currentType && currentType !== 'image' && all[currentType]) {
      result[currentType] = all[currentType]
    }
    return result
  }
  // 文字类型：排除 image 专用类型
  const result = {}
  for (const key in all) {
    if (key !== 'image') {
      result[key] = all[key]
    }
  }
  return result
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

export default { recognize, isSensitive, getAllTypes, getTypesForMediaType, addCustomType, deleteCustomType, onChange }
