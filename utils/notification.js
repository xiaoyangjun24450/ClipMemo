/**
 * 通知栏管理模块
 * 实现常驻通知栏、剪贴内容预览 + 复制按钮
 */

const NOTIFICATION_ID = 1001
const ACTION_COPY = 'com.clipmemo.ACTION_COPY'
let currentContent = ''

// #ifdef APP-PLUS
/**
 * 创建带按钮的常驻通知
 */
function createNativeNotification(content) {
	if (!plus.android) return false
	
	currentContent = content || '剪贴板监控已启动'
	
	try {
		const main = plus.android.runtimeMainActivity()
		
		const NotificationManager = plus.android.importClass('android.app.NotificationManager')
		const manager = main.getSystemService('notification')
		
		// 创建通知渠道
		const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')
		const channel = new NotificationChannel(
			'clipmemo_channel',
			'剪贴板监控',
			NotificationManager.IMPORTANCE_HIGH  // 改为 HIGH 以显示按钮
		)
		channel.setDescription('显示最新剪贴内容')
		channel.setShowBadge(false)
		channel.setSound(null)
		channel.enableVibration(false)
		manager.createNotificationChannel(channel)
		
		// 创建通知
		const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')
		const builder = new NotificationCompat.Builder(main, 'clipmemo_channel')
		
		builder.setContentTitle('ClipMemo')
		builder.setContentText(currentContent)
		
		// 系统图标
		const androidPkg = plus.android.importClass('android.R$drawable')
		builder.setSmallIcon(androidPkg.ic_dialog_info)
		
		builder.setOngoing(true)
		builder.setShowWhen(false)
		builder.setPriority(NotificationCompat.PRIORITY_HIGH)  // 改为 HIGH
		
		// ========== 添加复制按钮 ==========
		const Intent = plus.android.importClass('android.content.Intent')
		const PendingIntent = plus.android.importClass('android.app.PendingIntent')
		
		const copyIntent = new Intent(main, main.getClass())
		copyIntent.setAction(ACTION_COPY)
		copyIntent.putExtra('clip_content', currentContent)
		copyIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
		
		const copyPi = PendingIntent.getActivity(
			main,
			1,
			copyIntent,
			PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
		)
		
		builder.addAction(androidPkg.ic_menu_copy, '复制', copyPi)
		// ========== 按钮结束 ==========
		
		// 点击打开应用
		const mainIntent = new Intent()
		mainIntent.setClassName(main.getPackageName(), 'io.dcloud.' + main.getPackageName() + '.MainActivity')
		mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
		
		const mainPi = PendingIntent.getActivity(
			main,
			0,
			mainIntent,
			PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
		)
		builder.setContentIntent(mainPi)
		
		const notification = builder.build()
		manager.notify(NOTIFICATION_ID, notification)
		
		console.log('通知创建成功')
		return true
	} catch (e) {
		console.error('创建通知失败:', e)
		return false
	}
}

/**
 * 更新通知内容
 */
function updateNotification(content) {
	createNativeNotification(content)
}

/**
 * 取消通知
 */
function cancelNotification() {
	if (!plus.android) return
	try {
		const main = plus.android.runtimeMainActivity()
		const NotificationManager = plus.android.importClass('android.app.NotificationManager')
		const manager = main.getSystemService('notification')
		manager.cancel(NOTIFICATION_ID)
	} catch (e) {
		console.error('取消通知失败:', e)
	}
}

/**
 * 初始化通知栏
 */
function initNotification() {
	return createNativeNotification('剪贴板监控已启动')
}
// #endif

// #ifndef APP-PLUS
function initNotification() {
	console.warn('通知栏功能仅支持 App 平台')
	return false
}
function updateNotification() {}
function cancelNotification() {}
// #endif

/**
 * 格式化剪贴内容用于显示
 */
function formatContentForNotification(text, maxLength) {
	maxLength = maxLength || 50
	if (!text) return '暂无剪贴内容'
	text = text.toString().trim()
	if (text.length <= maxLength) return text
	return text.substring(0, maxLength) + '...'
}

export default {
	initNotification,
	updateNotification,
	cancelNotification,
	formatContentForNotification,
	NOTIFICATION_ID
}
