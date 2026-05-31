<template>
  <view class="page">
    <view class="section">
      <view class="setting-item">
        <view class="setting-left">
          <text class="setting-icon">👤</text>
          <text class="setting-label">登录设置</text>
        </view>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
      <view class="setting-item">
        <view class="setting-left">
          <text class="setting-icon">🔔</text>
          <text class="setting-label">通知设置</text>
        </view>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="setting-item">
        <view class="setting-left">
          <text class="setting-icon">🔄</text>
          <text class="setting-label">多端同步</text>
        </view>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
      <view class="setting-item">
        <view class="setting-left">
          <text class="setting-icon">💬</text>
          <text class="setting-label">加入QQ群</text>
        </view>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
      <view class="setting-item">
        <view class="setting-left">
          <text class="setting-icon">📦</text>
          <text class="setting-label">检查更新</text>
        </view>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {}
  },
}
</script>

<style>
.page {
  min-height: 100vh;
  background: #F5F5F5;
}

.section {
  background: #FFF;
  margin-bottom: 20rpx;
  border-radius: 16rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
  margin-top: 20rpx;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #F5F5F5;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-left {
  display: flex;
  align-items: center;
}

.setting-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.setting-label {
  font-size: 30rpx;
  color: #333;
}

.setting-right {
  display: flex;
  align-items: center;
}

.setting-arrow {
  font-size: 36rpx;
  color: #CCC;
  font-weight: 300;
}
</style>
