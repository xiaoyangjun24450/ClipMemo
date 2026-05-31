/**
 * 列表页业务逻辑 Mixin
 * 按模块拆分，每个领域职责单一：
 *   - clipboard.js   → 剪切板模块（读/写剪贴板）
 *   - storage.js     → 存储模块（增删改查、记录复制次数）
 *   - search.js      → 检索模块（本地搜索）
 *   - recognizer.js  → 本地类型识别
 *   - time.js        → 时间格式化
 *
 * TODO: 后端交互模块 (api.js) 接入后，saveWithAI 可改为调用 api.analyzeClip
 */
import storage from '@/utils/storage.js'
import clipboard from '@/utils/clipboard.js'
import recognizer from '@/utils/recognizer.js'
import timeUtil from '@/utils/time.js'
import searchUtil from '@/utils/search.js'

export const listMixin = {
  data() {
    return {
      searchKeyword: '',
      searchFocused: false,
      pendingContent: null,
      pendingRaw: null,
      notifyShow: false,
      analyzeItem: null,
      detailItem: null,
      clipList: [],
      displayCount: 20,
      _searchTimer: null,
    }
  },

  computed: {
    displayList() {
      return this.clipList.slice(0, this.displayCount)
    },

    pendingPreview() {
      if (!this.pendingContent) return ''
      const t = this.pendingContent.replace(/\n/g, ' ').trim()
      return t.length > 20 ? t.substring(0, 20) + '...' : t
    },

    typeOptions() {
      const config = recognizer.TYPE_CONFIG
      return Object.keys(config).map(k => ({
        value: k,
        icon: config[k].icon,
        label: config[k].label,
        color: config[k].color,
      }))
    },
  },

  onShow() {
    this.loadList()
    this.checkNewClip()
  },

  onUnload() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
      this._searchTimer = null
    }
  },

  methods: {
    // ==================== 数据加载 ====================
    loadList() {
      const raw = storage.getHistory()
      this.clipList = raw.map(item => ({
        ...item,
        ...this._getTypeDisplay(item),
      }))
    },

    // ==================== 格式化 ====================
    _getTypeDisplay(item) {
      const type = item.aiType || item.rawType || 'text'
      const config = recognizer.TYPE_CONFIG[type] || recognizer.TYPE_CONFIG.text
      return {
        typeIcon: config.icon,
        typeColor: config.color,
        typeLabel: item.aiTypeLabel || item.rawTypeLabel || config.label,
      }
    },

    formatPreview(content) {
      if (!content) return ''
      const t = String(content).replace(/\n/g, ' ').trim()
      return t.length > 60 ? t.substring(0, 60) + '...' : t
    },

    formatTime(ts) {
      return timeUtil.relativeTime(ts)
    },

    // ==================== 剪贴板检测 ====================
    async checkNewClip() {
      try {
        const text = await clipboard.getClipboardText()
        if (!text || !text.trim()) return
        const history = storage.getHistory()
        if (history.length > 0 && history[0].content === text) return
        const raw = recognizer.recognize(text)
        this.pendingContent = text
        this.pendingRaw = raw
        this.$nextTick(() => {
          this.notifyShow = true
        })
      } catch (e) {
        console.error('检测剪贴板失败:', e)
      }
    },

    ignoreClip() {
      this.notifyShow = false
      setTimeout(() => {
        this.pendingContent = null
      }, 300)
    },

    openAnalyze() {
      this.notifyShow = false
      this.analyzeItem = {
        content: this.pendingContent,
        ...this.pendingRaw,
      }
    },

    closeAnalyze() {
      this.analyzeItem = null
      this.pendingContent = null
      this.pendingRaw = null
    },

    // ==================== 保存 ====================
    saveLocal() {
      const item = this.analyzeItem
      storage.addClip(item.content, {
        rawType: item.type,
        rawTypeLabel: item.label,
        typeIcon: item.icon,
        typeColor: item.color,
        copyCount: 0,
        tags: [],
      })
      this.closeAnalyze()
      this.loadList()
      uni.showToast({ title: '已保存到本地', icon: 'success', duration: 1500 })
    },

    saveWithAI() {
      // TODO: 接入后端 API 实现 AI 分析
      this.saveLocal()
    },

    // ==================== 搜索 ====================
    onSearchFocus() {
      this.searchFocused = true
    },

    onSearchBlur() {
      if (!this.searchKeyword) {
        this.searchFocused = false
      }
    },

    onSearchInput() {
      if (this._searchTimer) clearTimeout(this._searchTimer)
      this._searchTimer = setTimeout(() => {
        if (this.searchKeyword) {
          const raw = searchUtil.searchFromStorage(this.searchKeyword)
          this.clipList = raw.map(item => ({
            ...item,
            ...this._getTypeDisplay(item),
          }))
        } else {
          this.loadList()
        }
      }, 200)
    },

    clearSearch() {
      this.searchKeyword = ''
      this.searchFocused = false
      this.loadList()
    },

    // ==================== 卡片操作 ====================
    doCopy(item) {
      clipboard.setClipboardText(item.content)
      storage.recordCopyCount(item.id)
      item.copyCount = (item.copyCount || 0) + 1
      item.lastCopyTime = Date.now()
      uni.showToast({ title: '已复制', icon: 'success', duration: 1500 })
    },

    deleteItem(item) {
      storage.deleteClip(item.id)
      this.loadList()
      uni.showToast({ title: '已删除', icon: 'none', duration: 1500 })
    },

    // ==================== 详情弹窗 ====================
    openDetail(item) {
      const currentType = item.aiType || item.rawType || 'text'
      this.detailItem = {
        id: item.id,
        content: item.content,
        rawType: currentType,
        description: item.description || '',
        source: item.source || '',
        keywords: (item.keywords || []).join(', '),
        tags: [...(item.tags || [])],
        typeIcon: item.typeIcon,
        typeColor: item.typeColor,
        typeLabel: item.typeLabel,
        copyCount: item.copyCount || 0,
        time: item.time,
      }
    },

    closeDetail() {
      this.detailItem = null
    },

    selectType(typeVal) {
      if (!this.detailItem) return
      const cfg = recognizer.TYPE_CONFIG[typeVal]
      this.detailItem.rawType = typeVal
      this.detailItem.typeIcon = cfg.icon
      this.detailItem.typeColor = cfg.color
      this.detailItem.typeLabel = cfg.label
    },

    saveDetail() {
      if (!this.detailItem) return
      const history = storage.getHistory()
      const target = history.find(h => h.id === this.detailItem.id)
      if (!target) return

      target.content = this.detailItem.content
      target.rawType = this.detailItem.rawType
      target.typeIcon = this.detailItem.typeIcon
      target.typeColor = this.detailItem.typeColor
      target.rawTypeLabel = this.detailItem.typeLabel
      target.description = this.detailItem.description
      target.source = this.detailItem.source
      target.keywords = this.detailItem.keywords
        ? this.detailItem.keywords.split(',').map(s => s.trim()).filter(Boolean)
        : []
      target.tags = this.detailItem.tags

      storage.saveHistory(history)
      this.closeDetail()
      this.loadList()
      uni.showToast({ title: '已保存', icon: 'success', duration: 1500 })
    },

    addToKnowledgeGraph() {
      // TODO: 接入后端 api.addToKnowledgeGraph
      uni.showToast({ title: '知识图谱功能开发中', icon: 'none', duration: 1500 })
    },

    // ==================== 分页 ====================
    loadMore() {
      if (this.displayCount < this.clipList.length) {
        this.displayCount += 20
      }
    },
  },
}
