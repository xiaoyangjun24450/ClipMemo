/**
 * 剪贴板监控模块
 * 监控系统剪贴板变化，自动收录新内容
 * 
 * 使用方式:
 * import clipboard from '@/utils/clipboard.js'
 * clipboard.initClipboardMonitor((content) => {
 *     console.log('新剪贴内容:', content)
 * })
 */

let lastClipContent = ''
let onClipChangeCallback = null
let monitorInterval = null

// #ifdef APP-PLUS
/**
 * 获取剪贴板文本内容 - 使用 uni-app 原生 API
 */
function getClipboardText() {
	return new Promise((resolve) => {
		uni.getClipboardData({
			success: (res) => {
				resolve(res.data || '')
			},
			fail: () => {
				resolve('')
			}
		})
	})
}

/**
 * 设置剪贴板内容 - 使用 uni-app 原生 API
 */
function setClipboardText(text) {
	return new Promise((resolve) => {
		if (!text) {
			resolve(false)
			return
		}
		uni.setClipboardData({
			data: text,
			success: () => {
				lastClipContent = text
				resolve(true)
			},
			fail: () => {
				resolve(false)
			}
		})
	})
}

/**
 * 同步获取剪贴板内容
 */
function getClipboardTextSync() {
	// 使用同步方式获取
	let result = ''
	uni.getClipboardData({
		success: (res) => {
			result = res.data || ''
		}
	})
	return result
}

/**
 * 剪贴板内容变化检测
 */
async function checkClipboard() {
	try {
		const newContent = await getClipboardText()
		if (newContent && newContent !== lastClipContent) {
			lastClipContent = newContent
			if (onClipChangeCallback) {
				onClipChangeCallback(newContent)
			}
		}
	} catch (e) {
		console.error('检测剪贴板失败:', e)
	}
}

/**
 * 初始化剪贴板监控
 */
async function initClipboardMonitor(callback) {
	onClipChangeCallback = callback
	
	// 获取初始内容
	lastClipContent = await getClipboardText()
	
	// 使用轮询方式监控
	if (monitorInterval) {
		clearInterval(monitorInterval)
	}
	monitorInterval = setInterval(checkClipboard, 500)
	
	console.log('剪贴板监控已启动')
	return true
}

/**
 * 停止监控
 */
function stopMonitor() {
	if (monitorInterval) {
		clearInterval(monitorInterval)
		monitorInterval = null
	}
	onClipChangeCallback = null
	console.log('剪贴板监控已停止')
}
// #endif

// #ifndef APP-PLUS
function initClipboardMonitor(callback) {
	onClipChangeCallback = callback
	console.warn('剪贴板监控仅支持 App 平台')
	return false
}
function getClipboardText() { return Promise.resolve('') }
function setClipboardText() { return Promise.resolve(false) }
function stopMonitor() {}
// #endif

export default {
	initClipboardMonitor,
	getClipboardText,
	setClipboardText,
	stopMonitor
}
