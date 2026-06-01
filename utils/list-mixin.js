/**
 * 列表页业务逻辑 Mixin
 * 按模块拆分，每个领域职责单一：
 *   - clipboard.js   → 剪切板模块（读/写剪贴板）
 *   - storage.js     → 存储模块（增删改查、记录复制次数）
 *   - search.js      → 检索模块（本地搜索）
 *   - recognizer.js  → 本地类型识别
 *   - time.js        → 时间格式化
 *   - api.js         → 后端交互模块（AI 分析、同步、搜索）
 */
import storage from '@/utils/storage.js'
import clipboard from '@/utils/clipboard.js'
import recognizer from '@/utils/recognizer.js'
import timeUtil from '@/utils/time.js'
import searchUtil from '@/utils/search.js'
import sortUtil from '@/utils/sort.js'
import api from '@/utils/api.js'

export const listMixin = {
  data() {
    return {
      activeTab: 'home',
      searchKeyword: '',
      searchFocused: false,
      typeFilter: '',          // 类型过滤：空=全部，否则为指定类型值
      typeFilterOptions: [],   // 类型过滤选项列表
      sortMode: '',
      sortVisible: false,
      pendingContent: null,
      pendingRaw: null,
      notifyShow: false,
      analyzeItem: null,
      detailItem: null,
      clipList: [],
      displayCount: 20,
      _searchTimer: null,
      showAddType: false,
      newTypeName: '',
      // 删除类型确认
      showDeleteTypeConfirm: false,
      pendingDeleteTypeVal: '',
      pendingDeleteTypeLabel: '',
      pendingDeleteTypeAffectedCount: 0,
      // 分层搜索结果
      dataSourceResults: [],   // 数据来源匹配结果
      contentResults: [],      // 内容/关键词/描述匹配结果
      dataSourceExpanded: false, // 数据来源是否展开
      dataSourcePreview: 3,    // 数据来源默认预览条数
      _typeVersion: 0,         // 类型版本号，用于触发 computed 重新计算
    }
  },

  computed: {
    // 是否处于搜索模式
    isSearchMode() {
      return !!this.searchKeyword || !!this.typeFilter
    },

    // 数据来源显示的条数（未展开时预览3条）
    visibleDataSourceResults() {
      if (!this.dataSourceResults.length) return []
      return this.dataSourceExpanded
        ? this.dataSourceResults
        : this.dataSourceResults.slice(0, this.dataSourcePreview)
    },

    // 展示列表：搜索模式下使用分层结果，否则显示普通列表
    displayList() {
      if (this.isSearchMode) {
        // 搜索模式：拼接数据来源 + 内容/关键词/描述 结果（去重）
        const all = []
        const seen = new Set()
        for (const item of this.dataSourceResults) {
          if (!seen.has(item.id)) {
            all.push(item)
            seen.add(item.id)
          }
        }
        for (const item of this.contentResults) {
          if (!seen.has(item.id)) {
            all.push(item)
            seen.add(item.id)
          }
        }
        return all.slice(0, this.displayCount)
      }
      return this.clipList.slice(0, this.displayCount)
    },

    pendingPreview() {
      if (!this.pendingContent) return ''
      const t = this.pendingContent.replace(/\n/g, ' ').trim()
      return t.length > 20 ? t.substring(0, 20) + '...' : t
    },

    typeOptions() {
      void this._typeVersion  // 标记响应式依赖，确保类型变更时 computed 重新计算
      const allTypes = recognizer.getAllTypes()
      return Object.keys(allTypes).map(k => ({
        value: k,
        label: allTypes[k].label,
        color: allTypes[k].color,
        custom: allTypes[k].custom || false,
      }))
    },

    sortLabel() {
      return sortUtil.SORT_MODES[this.sortMode] ? sortUtil.SORT_MODES[this.sortMode].label : '排序'
    },

    sortOptions() {
      return Object.keys(sortUtil.SORT_MODES).map(k => ({
        value: k,
        label: sortUtil.SORT_MODES[k].label,
      }))
    },
  },

  mounted() {
    recognizer.onChange(() => { this._typeVersion++ })
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
      const sorted = this.sortMode ? sortUtil.sort(this.sortMode, raw) : raw
      this.clipList = sorted.map(item => ({
        ...item,
        ...this._getTypeDisplay(item),
      }))
      // 构建类型过滤选项（从实际数据中提取已有类型）
      this._buildTypeFilterOptions()
      // 如果当前在搜索模式，重新触发搜索
      if (this.isSearchMode) {
        this._doLayeredSearch()
      }
    },

    /**
     * 从当前列表中提取已有类型，构建过滤选项
     */
    _buildTypeFilterOptions() {
      const seen = new Set()
      const options = [{ value: '', label: '全部类型', color: '#95A5A6' }]
      for (const item of this.clipList) {
        const typeVal = item.aiType || item.rawType || 'text'
        if (!seen.has(typeVal)) {
          seen.add(typeVal)
          const allTypes = recognizer.getAllTypes()
          const cfg = allTypes[typeVal]
          options.push({
            value: typeVal,
            label: cfg ? cfg.label : (item.aiTypeLabel || item.rawTypeLabel || typeVal),
            color: cfg ? cfg.color : (item.typeColor || '#95A5A6'),
          })
        }
      }
      this.typeFilterOptions = options
    },

    applySort() {
      if (!this.sortMode) return
      const raw = this.clipList
      const sorted = sortUtil.sort(this.sortMode, raw)
      this.clipList = sorted.map(item => ({
        ...item,
        ...this._getTypeDisplay(item),
      }))
    },

    toggleSort() {
      this.sortVisible = !this.sortVisible
    },

    selectSort(mode) {
      this.sortMode = mode
      this.sortVisible = false
      this.loadList()
    },

    // ==================== 格式化 ====================
    _getTypeDisplay(item) {
      const type = item.aiType || item.rawType || 'text'
      const allTypes = recognizer.getAllTypes()
      const config = allTypes[type] || allTypes.text
      return {
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
        const raw = { type: 'text', label: '未知文本', color: '#95A5A6' }
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
        typeLabel: item.label,
        typeColor: item.color,
        copyCount: 0,
        tags: [],
      })
      this.closeAnalyze()
      this.loadList()
      uni.showToast({ title: '已保存到本地', icon: 'success', duration: 1500 })
    },

    saveWithAI() {
      const item = this.analyzeItem
      if (!item || !item.content) return

      uni.showLoading({ title: 'AI 分析中...', mask: true })

      api.analyzeClip({ content: item.content }).then(result => {
        uni.hideLoading()

        // 匹配类型颜色
        const allTypes = recognizer.getAllTypes()
        const matchedType = allTypes[result.aiType]
        const typeLabel = matchedType ? matchedType.label : result.aiType
        const typeColor = matchedType ? matchedType.color : '#3498DB'

        storage.addClip(item.content, {
          rawType: item.type,
          rawTypeLabel: item.label,
          aiType: result.aiType,
          aiTypeLabel: typeLabel,
          typeLabel: typeLabel,
          typeColor: typeColor,
          tags: result.keywords || [],
          summary: result.description || '',
          dataSource: result.dataSource || '',
          copyCount: 0,
        })
        this.closeAnalyze()
        this.loadList()
        uni.showToast({ title: '已保存并完成AI分析', icon: 'success', duration: 1500 })
      }).catch(err => {
        uni.hideLoading()
        console.error('AI分析失败，降级为本地保存:', err)
        this.saveLocal()
        uni.showToast({ title: 'AI分析失败，已本地保存', icon: 'none', duration: 2000 })
      })
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
        this._doLayeredSearch()
      }, 200)
    },

    /**
     * 执行分层搜索
     */
    _doLayeredSearch() {
      if (this.searchKeyword || this.typeFilter) {
        const result = searchUtil.layeredSearch(
          this.searchKeyword,
          this.typeFilter || null,
          this.clipList
        )
        this.dataSourceResults = result.dataSourceResults
        this.contentResults = result.contentResults
        this.dataSourceExpanded = false
        this.displayCount = 20
      } else {
        this.dataSourceResults = []
        this.contentResults = []
        this.loadList()
      }
    },

    /**
     * 选择类型过滤
     */
    selectTypeFilter(value) {
      this.typeFilter = value
      if (this._searchTimer) clearTimeout(this._searchTimer)
      this._searchTimer = setTimeout(() => {
        this._doLayeredSearch()
      }, 100)
    },

    /**
     * 展开/收起数据来源结果
     */
    toggleDataSourceExpand() {
      this.dataSourceExpanded = !this.dataSourceExpanded
    },

    clearSearch() {
      this.searchKeyword = ''
      this.typeFilter = ''
      this.searchFocused = false
      this.dataSourceResults = []
      this.contentResults = []
      this.dataSourceExpanded = false
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
        description: item.summary || '',
        source: item.dataSource || '',
        keywords: (item.tags || []).join(', '),
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
      const allTypes = recognizer.getAllTypes()
      const cfg = allTypes[typeVal]
      this.detailItem.rawType = typeVal
      this.detailItem.typeColor = cfg.color
      this.detailItem.typeLabel = cfg.label
    },

    saveDetail() {
      if (!this.detailItem) return
      const history = storage.getHistory()
      const target = history.find(h => h.id === this.detailItem.id)
      if (!target) return

      // 如果用户手动改了类型，清除 AI 类型以让手动选择生效
      const newRawType = this.detailItem.rawType
      if (newRawType && newRawType !== (target.aiType || target.rawType || 'text')) {
        target.aiType = ''
        target.aiTypeLabel = ''
      }

      target.content = this.detailItem.content
      target.rawType = newRawType
      target.typeColor = this.detailItem.typeColor
      target.rawTypeLabel = this.detailItem.typeLabel
      target.summary = this.detailItem.description
      target.dataSource = this.detailItem.source
      target.tags = this.detailItem.keywords
        ? this.detailItem.keywords.split(',').map(s => s.trim()).filter(Boolean)
        : []

      storage.saveHistory(history)
      this.closeDetail()
      this.loadList()
      uni.showToast({ title: '已保存', icon: 'success', duration: 1500 })
    },

    addToKnowledgeGraph() {
      // TODO: 接入后端 api.addToKnowledgeGraph
      uni.showToast({ title: '知识图谱功能开发中', icon: 'none', duration: 1500 })
    },

    // ==================== 底部导航 ====================
    switchTab(tab) {
      this.activeTab = tab
      if (tab === 'knowledge') {
        uni.showToast({ title: '知识图谱开发中', icon: 'none', duration: 1500 })
      } else if (tab === 'settings') {
        uni.navigateTo({ url: '/pages/settings/settings' })
      }
    },

    // ==================== 自定义类型 ====================
    showAddTypeDialog() {
      this.showAddType = true
      this.newTypeName = ''
    },

    cancelAddType() {
      this.showAddType = false
      this.newTypeName = ''
    },

    confirmAddType() {
      const name = this.newTypeName.trim()
      if (!name) {
        uni.showToast({ title: '请输入类型名称', icon: 'none', duration: 1500 })
        return
      }
      recognizer.addCustomType(name)
      this.showAddType = false
      this.newTypeName = ''
      uni.showToast({ title: '已添加"' + name + '"', icon: 'success', duration: 1500 })
    },

    doDeleteCustomType(typeVal) {
      // 统计使用该类型的条目数
      const allTypes = recognizer.getAllTypes()
      const typeLabel = allTypes[typeVal] ? allTypes[typeVal].label : typeVal
      const affectedCount = this.clipList.filter(item => (item.aiType || item.rawType) === typeVal).length

      // 打开确认弹窗
      this.pendingDeleteTypeVal = typeVal
      this.pendingDeleteTypeLabel = typeLabel
      this.pendingDeleteTypeAffectedCount = affectedCount
      this.showDeleteTypeConfirm = true
    },

    cancelDeleteType() {
      this.showDeleteTypeConfirm = false
      this.pendingDeleteTypeVal = ''
      this.pendingDeleteTypeLabel = ''
      this.pendingDeleteTypeAffectedCount = 0
    },

    confirmDeleteType() {
      const typeVal = this.pendingDeleteTypeVal
      const typeLabel = this.pendingDeleteTypeLabel
      const affectedCount = this.pendingDeleteTypeAffectedCount

      // 关闭弹窗
      this.cancelDeleteType()

      // 批量将使用该类型的内容改为未知文本
      if (affectedCount > 0) {
        storage.batchUpdateTypeToText(typeVal)
      }

      // 删除自定义类型
      recognizer.deleteCustomType(typeVal)

      // 如果当前详情项正在使用被删除的类型，切换回未知文本
      if (this.detailItem && this.detailItem.rawType === typeVal) {
        const textCfg = recognizer.getAllTypes().text
        this.detailItem.rawType = 'text'
        this.detailItem.typeColor = textCfg.color
        this.detailItem.typeLabel = textCfg.label
      }

      // 刷新列表
      if (affectedCount > 0) {
        this.loadList()
      }

      uni.showToast({ title: '已删除类型"' + typeLabel + '"', icon: 'none', duration: 1500 })
    },

    // ==================== 分页 ====================
    loadMore() {
      if (this.displayCount < this.clipList.length) {
        this.displayCount += 20
      }
    },
  },
}
