<script>
import notification from './utils/notification.js'
import clipboard from './utils/clipboard.js'
import storage from './utils/storage.js'

export default {
	onLaunch: function() {
		console.log('App Launch')
		// this.initServices()  // 通知事件暂时关闭
	},
	onShow: function() {
		console.log('App Show')
		// #ifdef APP-PLUS
		this.handleIntent()
		// #endif
	},
	onHide: function() {
		console.log('App Hide')
	},
	methods: {
		// 处理通知栏按钮 Intent
		handleIntent() {
			// #ifdef APP-PLUS
			try {
				const main = plus.android.runtimeMainActivity()
				const Intent = plus.android.importClass('android.content.Intent')
				const intent = main.getIntent()
				
				const action = intent.getAction()
				if (action === 'com.clipmemo.ACTION_COPY') {
					const content = intent.getStringExtra('clip_content')
					if (content) {
						// 复制到剪贴板
						clipboard.setClipboardText(content)
						uni.showToast({
							title: '已复制到剪贴板',
							icon: 'success',
							duration: 1500
						})
						console.log('从通知栏复制:', content)
					}
					// 清空 intent 避免重复处理
					intent.setAction('')
				}
			} catch (e) {
				console.error('处理 Intent 失败:', e)
			}
			// #endif
		},
		
		// 初始化服务
		initServices() {
			// #ifdef APP-PLUS
			this.initNotification()
			this.initClipboardMonitor()
			// #endif
		},
		
		// 初始化通知栏
		initNotification() {
			try {
				notification.initNotification()
				const latest = storage.getLatestClip()
				if (latest) {
					const content = notification.formatContentForNotification(latest.content)
					notification.updateNotification(content)
				}
			} catch (e) {
				console.error('通知栏初始化失败:', e)
			}
		},
		
		// 初始化剪贴板监控
		async initClipboardMonitor() {
			await clipboard.initClipboardMonitor((newContent) => {
				const clip = storage.addClip(newContent, { rawType: 'text', rawTypeLabel: '文本' })
				const preview = notification.formatContentForNotification(clip.content)
				notification.updateNotification(preview)
				console.log('新剪贴内容已收录:', clip.id)
			})
		}
	}
}
</script>

<style>
/*每个页面公共css */
</style>
