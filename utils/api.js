/**
 * 后端交互模块
 * 负责与云端 API 通信：AI 分析、语义搜索、同步等
 */

import recognizer from './recognizer.js'

/**
 * 发送指定内容给后端（AI 分析）
 * @param {object} clip - 单条剪贴内容 { content: string }
 * @returns {Promise<{ aiType: string, dataSource: string, description: string, keywords: string[] }>}
 */
function analyzeClip(clip) {
  const types = recognizer.getAllTypes()
  return new Promise((resolve, reject) => {
    uniCloud.callFunction({
      name: 'clip-analyze',
      data: {
        content: clip.content,
        types: types,
      },
      success(res) {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data)
        } else {
          reject(new Error((res.result && res.result.msg) || 'AI分析失败'))
        }
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

/**
 * 发送所有历史记录给后端（批量同步/备份）
 * @param {Array} clips - 全部历史记录
 * @returns {Promise<{ success: boolean, synced: number }>}
 */
function syncAllClips(clips) {
  // TODO
  return Promise.reject(new Error('后端接口尚未接入'))
}

/**
 * 语义搜索（后端搜索）
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Array>} - 搜索结果列表
 */
function semanticSearch(keyword) {
  // TODO
  return Promise.reject(new Error('后端接口尚未接入'))
}

/**
 * 将单条数据加入知识图谱
 * @param {object} clip - 剪贴内容对象
 * @returns {Promise<{ success: boolean }>}
 */
function addToKnowledgeGraph(clip) {
  // TODO
  return Promise.reject(new Error('后端接口尚未接入'))
}

export default {
  analyzeClip,
  syncAllClips,
  semanticSearch,
  addToKnowledgeGraph,
}
