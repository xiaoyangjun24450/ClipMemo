<template>
  <view class="page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap" :class="{ focused: searchFocused }">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索剪贴内容..."
          :focus="searchFocused"
          @focus="onSearchFocus"
          @blur="onSearchBlur"
          @input="onSearchInput"
        />
        <text v-if="searchKeyword" class="search-clear" @click="clearSearch">✕</text>
      </view>
      <view class="filter-btn" @click="toggleFilter" :class="{ active: filterType }">
        <text>{{ filterType ? typeMap[filterType]?.icon || '📋' : '📋' }}</text>
      </view>
    </view>

    <!-- 类型筛选下拉 -->
    <view v-if="showFilter" class="filter-dropdown">
      <view class="filter-item" :class="{ active: !filterType }" @click="setFilter('')">全部</view>
      <view
        v-for="item in filterTypes"
        :key="item.type"
        class="filter-item"
        :class="{ active: filterType === item.type }"
        @click="setFilter(item.type)"
      >
        {{ item.icon }} {{ item.label }}
      </view>
    </view>

    <!-- 新内容通知条 -->
    <view v-if="pendingContent" class="notify-bar" :class="{ show: notifyShow }">
      <text class="notify-icon">📋</text>
      <text class="notify-text">检测到："{{ pendingPreview }}"</text>
      <view class="notify-actions">
        <text class="notify-btn ignore" @click="ignoreClip">忽略</text>
        <text class="notify-btn view" @click="openAnalyze">查看</text>
      </view>
    </view>

    <!-- 内容列表 -->
    <scroll-view
      v-if="displayList.length > 0"
      class="list"
      scroll-y
      @scrolltolower="loadMore"
    >
      <view
        v-for="item in displayList"
        :key="item.id"
        class="clip-card"
        @click="openDetail(item)"
      >
        <view class="card-header">
          <view class="card-type" :style="{ color: item.typeColor || '#95A5A6' }">
            <text>{{ item.typeIcon || '💬' }}</text>
            <text class="card-type-label">{{ item.typeLabel || '文本' }}</text>
          </view>
        </view>
        <view class="card-tags" v-if="item.tags && item.tags.length > 0">
          <text v-for="tag in item.tags" :key="tag" class="card-tag">#{{ tag }}</text>
        </view>
        <view class="card-content">{{ formatPreview(item.content) }}</view>
        <view class="card-footer">
          <text class="card-time">{{ formatTime(item.time) }}</text>
          <text v-if="item.copyCount > 0" class="card-count">· 已复制{{ item.copyCount }}次</text>
        </view>
        <view class="card-actions">
          <view class="action-btn copy" @click.stop="doCopy(item)">
            <text>复制</text>
          </view>
          <view class="action-btn more" @click.stop="showMore(item)">
            <text>···</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 空态 -->
    <view v-else class="empty">
      <text class="empty-icon">📋</text>
      <text class="empty-text">还没有内容</text>
      <text class="empty-sub">复制后切回来试试</text>
    </view>

    <!-- 操作菜单 -->
    <view v-if="menuItem" class="overlay" @click="closeMenu">
      <view class="menu-sheet">
        <view class="menu-item" @click.stop="deleteItem">删除</view>
        <view class="menu-item" @click.stop="editTags">编辑标签</view>
        <view class="menu-item cancel" @click.stop="closeMenu">取消</view>
      </view>
    </view>

    <!-- 分析面板（半屏） -->
    <view v-if="analyzeItem" class="overlay" @click="closeAnalyze">
      <view class="analyze-panel" @click.stop>
        <view class="panel-header">
          <text class="panel-title">剪贴板内容</text>
          <text class="panel-close" @click="closeAnalyze">✕</text>
        </view>
        <scroll-view class="panel-body" scroll-y>
          <view class="panel-content">{{ analyzeItem.content }}</view>
        </scroll-view>
        <view class="panel-recognize">
          <text class="panel-recognize-icon">{{ analyzeItem.typeIcon || '💬' }}</text>
          <text>识别类型：{{ analyzeItem.typeLabel || '文本' }}</text>
        </view>
        <view class="panel-actions">
          <view class="panel-btn ignore" @click="closeAnalyze">不存</view>
          <view class="panel-btn local" @click="saveLocal">仅保存到本地</view>
          <view class="panel-btn ai" @click="saveWithAI">存入并AI分析</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import storage from '@/utils/storage.js'
import clipboard from '@/utils/clipboard.js'
import recognizer from '@/utils/recognizer.js'
import timeUtil from '@/utils/time.js'

export default {
  data() {
    return {
      searchKeyword: '',
      searchFocused: false,
      showFilter: false,
      filterType: '',
      pendingContent: null,
      pendingRaw: null,
      notifyShow: false,
      analyzeItem: null,
      menuItem: null,
      clipList: [],
      displayCount: 20,
    }
  },
  computed: {
    displayList() {
      let list = this.clipList
      if (this.filterType) {
        list = list.filter(item => item.aiType === this.filterType || item.rawType === this.filterType)
      }
      return list.slice(0, this.displayCount)
    },
    pendingPreview() {
      if (!this.pendingContent) return ''
      const t = this.pendingContent.replace(/\n/g, ' ').trim()
      return t.length > 20 ? t.substring(0, 20) + '...' : t
    },
    typeMap() {
      return recognizer.TYPE_CONFIG
    },
    filterTypes() {
      const set = new Set()
      this.clipList.forEach(item => {
        if (item.aiType) set.add(item.aiType)
        else if (item.rawType) set.add(item.rawType)
      })
      return [...set].map(t => ({ type: t, ...(recognizer.TYPE_CONFIG[t] || recognizer.TYPE_CONFIG.text) }))
    }
  },
  onShow() {
    this.loadList()
    this.checkNewClip()
  },
  methods: {
    loadList() {
      const raw = storage.getHistory()
      this.clipList = raw.map(item => ({
        ...item,
        ...this.getTypeDisplay(item),
      }))
    },

    getTypeDisplay(item) {
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

    // 检查新剪贴板内容
    async checkNewClip() {
      try {
        const text = await clipboard.getClipboardText()
        if (!text || !text.trim()) return
        const history = storage.getHistory()
        if (history.length > 0 && history[0].content === text) return
        // 新内容
        const raw = recognizer.recognize(text)
        this.pendingContent = text
        this.pendingRaw = raw
        this.$nextTick(() => { this.notifyShow = true })
      } catch (e) {
        console.error('检测剪贴板失败:', e)
      }
    },

    ignoreClip() {
      this.notifyShow = false
      setTimeout(() => { this.pendingContent = null }, 300)
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
      // TODO: 接入后端 API
      this.saveLocal()
    },

    // 搜索
    onSearchFocus() {
      this.searchFocused = true
    },
    onSearchBlur() {
      if (!this.searchKeyword) {
        this.searchFocused = false
      }
    },
    onSearchInput() {
      // 200ms 防抖
      if (this._searchTimer) clearTimeout(this._searchTimer)
      this._searchTimer = setTimeout(() => {
        if (this.searchKeyword) {
          this.clipList = storage.searchClips(this.searchKeyword).map(item => ({
            ...item,
            ...this.getTypeDisplay(item),
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

    // 类型筛选
    toggleFilter() {
      this.showFilter = !this.showFilter
    },
    setFilter(type) {
      this.filterType = type
      this.showFilter = false
    },

    // 卡片操作
    doCopy(item) {
      clipboard.setClipboardText(item.content)
      item.copyCount = (item.copyCount || 0) + 1
      item.lastCopyTime = Date.now()
      // 更新到存储
      const history = storage.getHistory()
      const target = history.find(h => h.id === item.id)
      if (target) {
        target.copyCount = item.copyCount
        target.lastCopyTime = item.lastCopyTime
        storage.saveHistory(history)
      }
      uni.showToast({ title: '已复制', icon: 'success', duration: 1500 })
    },

    showMore(item) {
      this.menuItem = item
    },
    closeMenu() {
      this.menuItem = null
    },
    deleteItem() {
      if (this.menuItem) {
        storage.deleteClip(this.menuItem.id)
        this.closeMenu()
        this.loadList()
        uni.showToast({ title: '已删除', icon: 'none', duration: 1500 })
      }
    },
    editTags() {
      // TODO: 标签编辑弹窗
      uni.showToast({ title: '标签编辑功能开发中', icon: 'none' })
      this.closeMenu()
    },

    openDetail(item) {
      // TODO: 跳转详情页
      uni.showToast({ title: '详情页开发中', icon: 'none' })
    },

    loadMore() {
      if (this.displayCount < this.clipList.length) {
        this.displayCount += 20
      }
    },
  },
}
</script>

<style>
.page {
  min-height: 100vh;
  background: #F5F5F5;
  display: flex;
  flex-direction: column;
}

/* ========== 搜索栏 ========== */
.search-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #FFFFFF;
  position: sticky;
  top: 0;
  z-index: 100;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  height: 64rpx;
  background: #F5F5F5;
  border-radius: 32rpx;
  padding: 0 20rpx;
  transition: background 0.2s;
}
.search-input-wrap.focused {
  background: #EEEEEE;
}
.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}
.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}
.search-clear {
  font-size: 28rpx;
  color: #999;
  padding: 8rpx;
}
.filter-btn {
  margin-left: 16rpx;
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  background: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
.filter-btn.active {
  background: #E8F4FD;
}

/* ========== 筛选下拉 ========== */
.filter-dropdown {
  display: flex;
  flex-wrap: wrap;
  padding: 12rpx 24rpx;
  background: #FFF;
  border-bottom: 1rpx solid #F0F0F0;
}
.filter-item {
  padding: 8rpx 20rpx;
  margin: 6rpx 8rpx;
  font-size: 24rpx;
  color: #666;
  background: #F5F5F5;
  border-radius: 24rpx;
}
.filter-item.active {
  color: #FFF;
  background: #3498DB;
}

/* ========== 通知条 ========== */
.notify-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #E8F4FD;
  border-bottom: 1rpx solid #D0E8F8;
  transform: translateY(-100%);
  opacity: 0;
  transition: all 0.3s;
}
.notify-bar.show {
  transform: translateY(0);
  opacity: 1;
}
.notify-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}
.notify-text {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}
.notify-actions {
  display: flex;
  gap: 16rpx;
}
.notify-btn {
  font-size: 26rpx;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
}
.notify-btn.ignore {
  color: #999;
  background: #F0F0F0;
}
.notify-btn.view {
  color: #FFF;
  background: #3498DB;
}

/* ========== 列表 ========== */
.list {
  flex: 1;
  padding: 16rpx 24rpx;
}
.clip-card {
  background: #FFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  position: relative;
}
.card-header {
  margin-bottom: 12rpx;
}
.card-type {
  display: flex;
  align-items: center;
  font-size: 22rpx;
}
.card-type-label {
  margin-left: 6rpx;
  font-weight: 500;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 10rpx;
}
.card-tag {
  font-size: 22rpx;
  color: #3498DB;
  margin-right: 12rpx;
}
.card-content {
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.card-footer {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #999;
}
.card-actions {
  position: absolute;
  right: 24rpx;
  bottom: 20rpx;
  display: flex;
  gap: 12rpx;
}
.action-btn {
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}
.action-btn.copy {
  color: #3498DB;
  background: #E8F4FD;
}
.action-btn.more {
  color: #999;
  background: #F5F5F5;
}

/* ========== 空态 ========== */
.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 120rpx;
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 12rpx;
}
.empty-sub {
  font-size: 26rpx;
  color: #999;
}

/* ========== 遮罩 & 菜单 ========== */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.menu-sheet {
  width: 100%;
  background: #FFF;
  border-radius: 24rpx 24rpx 0 0;
  padding: 16rpx 0;
}
.menu-item {
  text-align: center;
  padding: 28rpx;
  font-size: 30rpx;
  color: #333;
  border-bottom: 1rpx solid #F0F0F0;
}
.menu-item.cancel {
  color: #999;
  border-bottom: none;
  margin-top: 8rpx;
}

/* ========== 分析面板 ========== */
.analyze-panel {
  width: 100%;
  background: #FFF;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid #F0F0F0;
}
.panel-title {
  font-size: 32rpx;
  font-weight: 600;
}
.panel-close {
  font-size: 32rpx;
  color: #999;
  padding: 8rpx;
}
.panel-body {
  padding: 24rpx;
  max-height: 400rpx;
}
.panel-content {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.panel-recognize {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #F8F8F8;
  font-size: 26rpx;
  color: #666;
}
.panel-recognize-icon {
  font-size: 30rpx;
  margin-right: 10rpx;
}
.panel-actions {
  display: flex;
  padding: 20rpx 24rpx;
  gap: 16rpx;
}
.panel-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: 500;
}
.panel-btn.ignore {
  color: #999;
  background: #F5F5F5;
  flex: 0.5;
}
.panel-btn.local {
  color: #3498DB;
  background: #E8F4FD;
}
.panel-btn.ai {
  color: #FFF;
  background: #3498DB;
}
</style>
