/**
 * 检索模块
 * 本地即时搜索：支持内容、标签、类型模糊匹配
 */
import storage from '@/utils/storage.js'

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
  searchFromStorage,
}
