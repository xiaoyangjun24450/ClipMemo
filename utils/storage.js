/**
 * 剪贴内容存储模块
 * 使用本地存储管理剪贴历史
 */

const STORAGE_KEY = 'clip_history'
const MAX_HISTORY = 100  // 最大历史记录数

/**
 * 获取所有历史记录
 */
function getHistory() {
	try {
		const data = uni.getStorageSync(STORAGE_KEY)
		return data ? JSON.parse(data) : []
	} catch (e) {
		console.error('读取历史记录失败:', e)
		return []
	}
}

/**
 * 保存历史记录
 */
function saveHistory(history) {
	try {
		uni.setStorageSync(STORAGE_KEY, JSON.stringify(history))
		return true
	} catch (e) {
		console.error('保存历史记录失败:', e)
		return false
	}
}

/**
 * 添加新剪贴内容
 * @param {string} content - 剪贴内容
 * @param {object} extra - 扩展字段 { rawType, rawTypeLabel, aiType, tags, summary, copyCount, ... }
 */
function addClip(content, extra = {}) {
	const history = getHistory()
	const now = Date.now()
	
	// 检查是否重复（与最近一条比较）
	if (history.length > 0 && history[0].content === content) {
		history[0].time = now
		saveHistory(history)
		return history[0]
	}
	
	// 创建新记录
	const newClip = {
		id: now.toString(),
		content: content,
		time: now,
		rawType: extra.rawType || 'text',
		rawTypeLabel: extra.rawTypeLabel || '文本',
		aiType: extra.aiType || '',
		aiTypeLabel: extra.aiTypeLabel || '',
		tags: extra.tags || [],
		summary: extra.summary || '',
		typeIcon: extra.typeIcon || '💬',
		typeColor: extra.typeColor || '#95A5A6',
		copyCount: extra.copyCount || 0,
		lastCopyTime: 0,
		collected: true,
	}
	
	// 添加到列表开头
	history.unshift(newClip)
	
	// 限制最大数量
	if (history.length > MAX_HISTORY) {
		history.splice(MAX_HISTORY)
	}
	
	saveHistory(history)
	return newClip
}

/**
 * 删除指定记录
 * @param {string} id - 记录ID
 */
function deleteClip(id) {
	const history = getHistory()
	const index = history.findIndex(item => item.id === id)
	if (index > -1) {
		history.splice(index, 1)
		saveHistory(history)
		return true
	}
	return false
}

/**
 * 清空所有记录
 */
function clearHistory() {
	saveHistory([])
	return true
}

/**
 * 搜索剪贴内容（支持内容+标签模糊匹配）
 * @param {string} keyword - 搜索关键词
 */
function searchClips(keyword) {
	if (!keyword) return getHistory()
	
	const history = getHistory()
	const lowerKeyword = keyword.toLowerCase()
	
	return history.filter(item => {
		// 匹配内容
		if (item.content && item.content.toLowerCase().includes(lowerKeyword)) return true
		// 匹配标签
		if (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))) return true
		// 匹配类型标签
		if (item.aiTypeLabel && item.aiTypeLabel.toLowerCase().includes(lowerKeyword)) return true
		if (item.rawTypeLabel && item.rawTypeLabel.toLowerCase().includes(lowerKeyword)) return true
		return false
	})
}

/**
 * 获取最新一条剪贴内容
 */
function getLatestClip() {
	const history = getHistory()
	return history.length > 0 ? history[0] : null
}

/**
 * 获取收录数量
 */
function getCollectedCount() {
	return getHistory().filter(item => item.collected).length
}

export default {
	getHistory,
	saveHistory,
	addClip,
	deleteClip,
	clearHistory,
	searchClips,
	getLatestClip,
	getCollectedCount
}
