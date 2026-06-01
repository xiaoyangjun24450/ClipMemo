/**
 * 检索模块
 * 本地即时搜索：支持内容、标签、类型模糊匹配
 * 分层搜索：先匹配数据来源（前3条+展开），再匹配关键词/内容/描述
 */
import storage from '@/utils/storage.js'

/**
 * 分层搜索：按数据来源优先，再按关键词/内容/描述搜索
 * @param {string} keyword - 搜索关键词
 * @param {string|null} typeFilter - 选中类型过滤（aiType/rawType），null 表示不过滤
 * @param {Array} clipList - 当前列表
 * @returns {{ dataSourceResults: Array, contentResults: Array }}
 */
function layeredSearch(keyword, typeFilter, clipList) {
  // 先按类型过滤
  let filtered = clipList
  if (typeFilter) {
    filtered = clipList.filter(item => {
      const itemType = item.aiType || item.rawType || 'text'
      return itemType === typeFilter
    })
  }

  // 无关键词时：仅按类型展示全部结果
  if (!keyword) return { dataSourceResults: [], contentResults: filtered }

  const lowerKeyword = keyword.toLowerCase()
  const dataSourceResults = []
  const contentResults = []

  for (const item of filtered) {
    // 匹配数据来源
    if (item.dataSource && item.dataSource.toLowerCase().includes(lowerKeyword)) {
      dataSourceResults.push(item)
    }

    // 匹配内容/标签/摘要（描述）
    let keywordMatch = false
    if (item.content && item.content.toLowerCase().includes(lowerKeyword)) keywordMatch = true
    if (!keywordMatch && item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))) keywordMatch = true
    if (!keywordMatch && item.summary && item.summary.toLowerCase().includes(lowerKeyword)) keywordMatch = true

    if (keywordMatch) {
      contentResults.push(item)
    }
  }

  return { dataSourceResults, contentResults }
}

/**
 * 本地即时搜索（直接在已加载的列表中过滤）
 * @param {string} keyword - 搜索关键词
 * @param {Array} clipList - 当前列表（已含类型显示信息）
 * @returns {Array} - 过滤后的列表
 */
function localSearch(keyword, clipList) {
  if (!keyword) return clipList

  const lowerKeyword = keyword.toLowerCase()

  return clipList.filter(item => {
    if (item.content && item.content.toLowerCase().includes(lowerKeyword)) return true
    if (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))) return true
    if (item.aiTypeLabel && item.aiTypeLabel.toLowerCase().includes(lowerKeyword)) return true
    if (item.rawTypeLabel && item.rawTypeLabel.toLowerCase().includes(lowerKeyword)) return true
    return false
  })
}

/**
 * 从存储中搜索（原始数据搜索，返回原始记录）
 * @param {string} keyword
 * @returns {Array}
 */
function searchFromStorage(keyword) {
  return storage.searchClips(keyword)
}

export default {
  localSearch,
  layeredSearch,
  searchFromStorage,
}
