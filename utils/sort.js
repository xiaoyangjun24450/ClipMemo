/**
 * 排序模块
 * 对剪贴内容列表按不同维度排序
 */

/**
 * 按复制时间排序（最近复制靠前）
 */
function byCopyTime(list) {
  return [...list].sort((a, b) => {
    const ta = a.lastCopyTime || 0
    const tb = b.lastCopyTime || 0
    return tb - ta
  })
}

/**
 * 按复制次数排序（复制多的靠前）
 */
function byCopyCount(list) {
  return [...list].sort((a, b) => {
    const ca = a.copyCount || 0
    const cb = b.copyCount || 0
    return cb - ca
  })
}

/**
 * 按存入时间排序（最新存入靠前）
 */
function byCreateTime(list) {
  return [...list].sort((a, b) => {
    const ta = a.time || 0
    const tb = b.time || 0
    return tb - ta
  })
}

/**
 * 排序策略映射
 */
const SORT_MODES = {
  copyTime:   { label: '按复制时间', fn: byCopyTime },
  copyCount:  { label: '按复制次数', fn: byCopyCount },
  createTime: { label: '按存入时间', fn: byCreateTime },
}

/**
 * 对列表应用排序
 * @param {string} mode - 'copyTime' | 'copyCount' | 'createTime'
 * @param {Array} list
 * @returns {Array} 排序后的新数组
 */
function sort(mode, list) {
  const modeConfig = SORT_MODES[mode]
  return modeConfig ? modeConfig.fn(list) : list
}

export default { sort, SORT_MODES, byCopyTime, byCopyCount, byCreateTime }
