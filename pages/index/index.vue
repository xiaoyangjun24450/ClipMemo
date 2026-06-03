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
      <view class="sort-btn" @click="toggleSort">
        <text class="sort-icon">⇅</text>
        <text class="sort-label">{{ sortLabel }}</text>
      </view>
    </view>

    <!-- 类型过滤条 -->
    <view v-if="searchFocused || typeFilter" class="type-filter-bar">
      <scroll-view class="type-filter-scroll" scroll-x :show-scrollbar="false">
        <view
          v-for="opt in typeFilterOptions"
          :key="opt.value"
          class="type-filter-chip"
          :class="{ active: typeFilter === opt.value }"
          :style="typeFilter === opt.value ? { borderColor: opt.color, background: opt.color + '18', color: opt.color } : {}"
          @click="selectTypeFilter(opt.value)"
        >
          <text>{{ opt.label }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 排序下拉 -->
    <view v-if="sortVisible" class="sort-mask" @click="toggleSort">
      <view class="sort-dropdown" @click.stop>
        <view
          v-for="opt in sortOptions"
          :key="opt.value"
          class="sort-option"
          :class="{ active: sortMode === opt.value }"
          @click="selectSort(opt.value)"
        >
          <text>{{ opt.label }}</text>
        </view>
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

    <!-- 搜索模式：分层结果 -->
    <scroll-view
      v-if="isSearchMode && (dataSourceResults.length > 0 || contentResults.length > 0)"
      class="list"
      scroll-y
      @scrolltolower="loadMore"
    >
      <!-- 数据来源匹配 -->
      <view v-if="dataSourceResults.length > 0" class="search-section">
        <view class="section-header">
          <text class="section-title">📡 数据来源匹配</text>
          <text class="section-count">{{ dataSourceResults.length }}条</text>
        </view>
        <view
          v-for="item in visibleDataSourceResults"
          :key="'ds-' + item.id"
          class="clip-card"
          @click="openDetail(item)"
        >
          <view class="card-header">
            <view class="card-type" :style="{ color: item.typeColor || '#95A5A6' }">
              <text class="card-type-label">{{ item.typeLabel || '未知文本' }}</text>
            </view>
            <text v-if="item.dataSource" class="card-source-tag">{{ item.dataSource }}</text>
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
            <view class="action-btn delete" @click.stop="deleteItem(item)">
              <text>删除</text>
            </view>
          </view>
        </view>
        <!-- 展开/收起按钮 -->
        <view
          v-if="dataSourceResults.length > dataSourcePreview"
          class="expand-btn"
          @click="toggleDataSourceExpand"
        >
          <text>{{ dataSourceExpanded ? '收起' : '展开全部 (' + dataSourceResults.length + '条)' }}</text>
          <text class="expand-arrow">{{ dataSourceExpanded ? '▲' : '▼' }}</text>
        </view>
      </view>

      <!-- 内容/关键词/描述匹配 -->
      <view v-if="contentResults.length > 0" class="search-section">
        <view class="section-header">
          <text class="section-title">📝 内容 / 关键词 / 描述匹配</text>
          <text class="section-count">{{ contentResults.length }}条</text>
        </view>
        <view
          v-for="item in contentResults"
          :key="'ct-' + item.id"
          class="clip-card"
          @click="openDetail(item)"
        >
          <view class="card-header">
            <view class="card-type" :style="{ color: item.typeColor || '#95A5A6' }">
              <text class="card-type-label">{{ item.typeLabel || '未知文本' }}</text>
            </view>
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
            <view class="action-btn delete" @click.stop="deleteItem(item)">
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 非搜索模式：普通列表 -->
    <scroll-view
      v-else-if="!isSearchMode && displayList.length > 0"
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
            <text class="card-type-label">{{ item.typeLabel || '未知文本' }}</text>
          </view>
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
          <view class="action-btn delete" @click.stop="deleteItem(item)">
            <text>删除</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 搜索空态 -->
    <view v-else-if="isSearchMode" class="empty">
      <text class="empty-icon">🔍</text>
      <text class="empty-text">没有找到匹配的内容</text>
      <text class="empty-sub">试试换个关键词或类型</text>
    </view>

    <!-- 普通空态 -->
    <view v-else class="empty">
      <text class="empty-icon">📋</text>
      <text class="empty-text">还没有内容</text>
      <text class="empty-sub">复制后切回来试试</text>
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
          <text>识别类型：{{ analyzeItem.typeLabel || '未知文本' }}</text>
        </view>
        <view class="panel-actions">
          <view class="panel-btn ignore" @click="closeAnalyze">不存</view>
          <view class="panel-btn local" @click="saveLocal">仅保存到本地</view>
          <view class="panel-btn ai" @click="saveWithAI">存入并AI分析</view>
        </view>
      </view>
    </view>

    <!-- 详情弹窗 -->
    <view v-if="detailItem" class="overlay" @click="closeDetail">
      <view class="detail-panel" @click.stop>
        <view class="panel-header">
          <text class="panel-title">详情</text>
          <text class="panel-close" @click="closeDetail">✕</text>
        </view>
        <scroll-view class="detail-body" scroll-y>
          <!-- 类型选择 -->
          <view class="detail-field">
            <text class="detail-label">类型</text>
            <scroll-view class="type-selector" scroll-x>
              <view
                v-for="opt in typeOptions"
                :key="opt.value"
                class="type-option"
                :class="{ active: detailItem.rawType === opt.value }"
                :style="detailItem.rawType === opt.value ? { borderColor: opt.color, background: opt.color + '18' } : {}"
                @click="selectType(opt.value)"
              >
                <text>{{ opt.label }}</text>
                <text v-if="opt.custom" class="type-del" @click.stop="doDeleteCustomType(opt.value)">×</text>
              </view>
              <view class="type-option type-add" @click="showAddTypeDialog">
                <text>+ 新增</text>
              </view>
            </scroll-view>
          </view>

          <!-- 描述 -->
          <view class="detail-field">
            <text class="detail-label">描述</text>
            <input
              class="detail-input"
              v-model="detailItem.description"
              placeholder="输入描述..."
            />
          </view>

          <!-- 数据来源 -->
          <view class="detail-field">
            <text class="detail-label">数据来源</text>
            <input
              class="detail-input"
              v-model="detailItem.source"
              placeholder="例如：微信、网页、手动输入"
            />
          </view>

          <!-- 关键词 -->
          <view class="detail-field">
            <text class="detail-label">关键词</text>
            <input
              class="detail-input"
              v-model="detailItem.keywords"
              placeholder="多个关键字以逗号分隔"
            />
          </view>

          <!-- 具体内容 -->
          <view class="detail-field">
            <text class="detail-label">具体内容</text>
            <textarea
              class="detail-textarea"
              v-model="detailItem.content"
              placeholder="内容"
              :auto-height="true"
            />
          </view>
        </scroll-view>

        <view class="detail-footer">
          <view class="panel-btn ai" @click="addToKnowledgeGraph">将该条数据加入知识图谱</view>
        </view>
        <view class="detail-actions">
          <view class="panel-btn local" @click="saveDetail">保存修改</view>
        </view>
      </view>
    </view>

    <!-- 新增类型弹窗 -->
    <view v-if="showAddType" class="overlay" @click="cancelAddType">
      <view class="type-dialog" @click.stop>
        <text class="dialog-title">添加新类型</text>
        <input
          class="dialog-input"
          v-model="newTypeName"
          placeholder="输入类型名称，如「脑洞」"
          :focus="true"
        />
        <view class="dialog-actions">
          <view class="dialog-btn cancel" @click="cancelAddType">取消</view>
          <view class="dialog-btn confirm" @click="confirmAddType">确定</view>
        </view>
      </view>
    </view>

    <!-- 删除类型确认弹窗 -->
    <view v-if="showDeleteTypeConfirm" class="overlay" @click="cancelDeleteType">
      <view class="type-dialog" @click.stop>
        <text class="dialog-title">确认删除类型</text>
        <text class="dialog-desc">
          删除「{{ pendingDeleteTypeLabel }}」后，{{ pendingDeleteTypeAffectedCount > 0 ? '已标记为该类型的 ' + pendingDeleteTypeAffectedCount + ' 条内容将被改为「未知文本」；' : '' }}此操作不可撤销。确定删除吗？
        </text>
        <view class="dialog-actions">
          <view class="dialog-btn cancel" @click="cancelDeleteType">取消</view>
          <view class="dialog-btn confirm danger" @click="confirmDeleteType">确定删除</view>
        </view>
      </view>
    </view>

    <!-- 删除内容确认弹窗 -->
    <view v-if="showDeleteConfirm" class="overlay" @click="cancelDeleteConfirm">
      <view class="type-dialog" @click.stop>
        <text class="dialog-title">确认删除</text>
        <text class="dialog-desc">确定要删除这条内容吗？</text>
        <view v-if="pendingDeleteItem" class="delete-preview">
          {{ formatPreview(pendingDeleteItem.content) }}
        </view>
        <view class="dialog-actions">
          <view class="dialog-btn cancel" @click="cancelDeleteConfirm">取消</view>
          <view class="dialog-btn confirm danger" @click="confirmDeleteItem">确定删除</view>
        </view>
      </view>
    </view>

    <!-- 底部导航栏 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: activeTab === 'home' }" @click="switchTab('home')">
        <text class="tab-icon">🏠</text>
        <text class="tab-text">主页</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'knowledge' }" @click="switchTab('knowledge')">
        <text class="tab-icon">🧠</text>
        <text class="tab-text">知识图谱</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'settings' }" @click="switchTab('settings')">
        <text class="tab-icon">⚙️</text>
        <text class="tab-text">设置</text>
      </view>
    </view>
  </view>
</template>

<script>
import { listMixin } from '@/utils/list-mixin.js'

export default {
  mixins: [listMixin],
}
</script>

<style>
.page {
  min-height: 100vh;
  background: #F5F5F5;
  display: flex;
  flex-direction: column;
  /* 为底部固定 tab-bar 留出空间 */
  padding-bottom: calc(88rpx + env(safe-area-inset-bottom, 0px));
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
.sort-btn {
  display: flex;
  align-items: center;
  margin-left: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 24rpx;
  background: #F5F5F5;
  white-space: nowrap;
}
.sort-icon {
  font-size: 24rpx;
  margin-right: 4rpx;
}
.sort-label {
  font-size: 24rpx;
  color: #666;
}

/* ========== 排序下拉 ========== */
.sort-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 300;
  background: transparent;
}
.sort-dropdown {
  position: absolute;
  top: 90rpx;
  right: 24rpx;
  background: #FFF;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.12);
  overflow: hidden;
}
.sort-option {
  padding: 22rpx 36rpx;
  font-size: 28rpx;
  color: #333;
  white-space: nowrap;
  border-bottom: 1rpx solid #F0F0F0;
}
.sort-option:last-child {
  border-bottom: none;
}
.sort-option.active {
  color: #3498DB;
  background: #E8F4FD;
}
/* ========== 通知条 ========== */
.notify-bar {
  position: sticky;
  top: 96rpx;
  z-index: 99;
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
  padding: 16rpx 0;
}
.clip-card {
  width: auto;
  background: #FFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 0 24rpx 16rpx;
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
  font-weight: 500;
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
.action-btn.delete {
  color: #E74C3C;
  background: #FDEDED;
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

/* ========== 类型过滤条 ========== */
.type-filter-bar {
  background: #FFFFFF;
  padding: 12rpx 24rpx 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
  position: sticky;
  top: 96rpx;
  z-index: 99;
}
.type-filter-scroll {
  white-space: nowrap;
}
.type-filter-chip {
  display: inline-block;
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  border: 2rpx solid #E8E8E8;
  margin-right: 12rpx;
  color: #666;
  background: #F8F8F8;
  transition: all 0.2s;
}
.type-filter-chip.active {
  font-weight: 500;
}

/* ========== 搜索分区 ========== */
.search-section {
  margin-bottom: 8rpx;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx 8rpx;
}
.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #333;
}
.section-count {
  font-size: 22rpx;
  color: #999;
  background: #F0F0F0;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

/* ========== 卡片来源标签 ========== */
.card-source-tag {
  font-size: 20rpx;
  color: #3498DB;
  background: #E8F4FD;
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  margin-left: 12rpx;
}

/* ========== 展开/收起按钮 ========== */
.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
  margin: 0 24rpx;
  font-size: 26rpx;
  color: #3498DB;
  background: #F5F9FF;
  border-radius: 12rpx;
  border: 1rpx dashed #B0D4F1;
}
.expand-arrow {
  margin-left: 8rpx;
  font-size: 22rpx;
}

/* ========== 遮罩 ========== */
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

/* ========== 详情弹窗 ========== */
.detail-panel {
  width: 100%;
  background: #FFF;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}
.detail-body {
  flex: 1;
  padding: 24rpx;
  max-height: 60vh;
}
.detail-field {
  margin-bottom: 28rpx;
}
.detail-label {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 12rpx;
}
.type-selector {
  white-space: nowrap;
}
.type-option {
  display: inline-block;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  border: 2rpx solid #E8E8E8;
  margin-right: 12rpx;
  color: #666;
  transition: all 0.2s;
}
.type-option.active {
  font-weight: 500;
}
.type-del {
  margin-left: 8rpx;
  font-size: 28rpx;
  color: #E74C3C;
  font-weight: bold;
  padding: 0 4rpx;
}
.type-add {
  border-style: dashed;
  color: #3498DB;
}
.detail-input {
  width: 100%;
  height: 72rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.detail-textarea {
  width: 100%;
  min-height: 160rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  line-height: 1.6;
  box-sizing: border-box;
}
.detail-footer {
  padding: 0 24rpx 8rpx;
}
.detail-actions {
  padding: 8rpx 24rpx 24rpx;
}

/* ========== 新增类型弹窗 ========== */
.type-dialog {
  width: 560rpx;
  background: #FFF;
  border-radius: 20rpx;
  padding: 36rpx;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 210;
}
.dialog-title {
  font-size: 32rpx;
  font-weight: 600;
  display: block;
  margin-bottom: 28rpx;
  text-align: center;
}
.dialog-input {
  width: 100%;
  height: 80rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 28rpx;
}
.dialog-actions {
  display: flex;
  gap: 20rpx;
}
.dialog-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 24rpx;
  font-size: 28rpx;
  font-weight: 500;
}
.dialog-btn.cancel {
  color: #999;
  background: #F5F5F5;
}
.dialog-btn.confirm {
  color: #FFF;
  background: #3498DB;
}
.dialog-btn.confirm.danger {
  background: #E74C3C;
}
.dialog-desc {
  display: block;
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  margin-bottom: 28rpx;
  text-align: center;
}
.delete-preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 26rpx;
  color: #888;
  line-height: 1.6;
  padding: 20rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
  margin-bottom: 28rpx;
  text-align: left;
}

/* ========== 底部导航栏 ========== */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: #FFF;
  border-top: 1rpx solid #F0F0F0;
  padding-bottom: env(safe-area-inset-bottom);
  padding-top: 12rpx;
}
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 0;
}
.tab-icon {
  font-size: 36rpx;
  margin-bottom: 4rpx;
}
.tab-text {
  font-size: 22rpx;
  color: #999;
}
.tab-item.active .tab-text {
  color: #3498DB;
  font-weight: 500;
}
</style>
