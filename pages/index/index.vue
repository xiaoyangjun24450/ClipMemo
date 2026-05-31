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
          <view class="action-btn delete" @click.stop="deleteItem(item)">
            <text>删除</text>
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
                <text>{{ opt.icon }} {{ opt.label }}</text>
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

          <!-- 索引关键字 -->
          <view class="detail-field">
            <text class="detail-label">索引关键字</text>
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
</style>
