# ClipMemo 代码结构设计

原则：一页一目录，公共组件抽离到 components，工具类放 utils，API 收敛到 api/。

---

## 一、Page 层

```
pages/
├── index/                       # 首页（时间线列表）
│   └── index.vue
├── detail/                      # 详情页
│   └── detail.vue
└── settings/                    # 设置页
    └── settings.vue
```

pages.json 注册三个页面，index 为首页入口。

---

## 二、Module 层

```
utils/                           # 纯逻辑模块，无 UI
├── clipboard.js                 # [已有] 剪贴板读/写/轮询（500ms）
├── storage.js                   # [已有] 本地存储 CRUD + 搜索，需扩展字段
├── notification.js              # [已有] 通知栏常驻 + 复制按钮
├── recognizer.js                # [新增] 本地类型识别，纯正则，返回 rawType
├── encrypt.js                   # [新增] 敏感内容 AES 加解密
├── search.js                    # [新增] 本地标签+内容模糊匹配，防抖封装
└── time.js                      # [新增] 相对时间格式化（"3分钟前"）

api/                             # [新增] 后端接口封装
├── index.js                     # uni.request 统一拦截（baseUrl/token/超时）
├── analyze.js                   # POST /api/analyze
├── search.js                    # POST /api/search
├── track.js                     # POST /api/track
└── fetchUrl.js                  # POST /api/fetch-url
```

---

## 三、Component 层（对应交互设计中的卡片）

```
components/
├── clip-card/                   # 卡片：内容条目（首页列表项）
│   └── clip-card.vue            #   类型图标 + 标签 + 预览 + 复制/更多按钮
├── notify-bar/                  # 卡片：新内容通知条（顶部滑入）
│   └── notify-bar.vue           #   "检测到:xxx..." [查看] [忽略]
├── analyze-panel/               # 卡片：分析面板（半屏弹窗）
│   └── analyze-panel.vue        #   内容预览 + 识别类型 + 三个操作按钮
├── analyze-result/              # 卡片：AI 分析结果
│   └── analyze-result.vue       #   最终类型 + 标签列表 + 摘要 + 确认/返回
├── tag-list/                    # 卡片：标签区（可增删，详情页+分析结果共用）
│   └── tag-list.vue
├── summary-card/                # 卡片：链接摘要区（仅链接类）
│   └── summary-card.vue
├── stat-bar/                    # 卡片：使用统计（复制次数+时间）
│   └── stat-bar.vue
├── search-bar/                  # 卡片：搜索栏（带防抖+类型筛选）
│   └── search-bar.vue
├── empty-state/                 # 通用：空态组件
│   └── empty-state.vue          #   图标 + 提示文字 + 可选操作按钮
└── type-icon/                   # 通用：类型图标（根据 type 映射颜色+icon）
    └── type-icon.vue
```

---

## 四、组件与页面的使用关系

### pages/index/index.vue
  引用: search-bar, notify-bar, clip-card, analyze-panel, analyze-result, empty-state

### pages/detail/detail.vue
  引用: type-icon, tag-list, summary-card, stat-bar

### pages/settings/settings.vue
  自闭合，不抽组件（就四个开关，不划算）

### App.vue
  引用: notification.js（已有），负责 onShow 检测剪贴板 + 触发 notify-bar

---

## 五、数据流

```
App.vue  onShow → clipboard.getText() → 对比 lastClipContent
  ↓ 有变化
notify-bar 弹出 → 用户点[查看]
  ↓
analyze-panel 展开 → recognizer.js 本地识别 rawType
  ↓ 用户选[存入并AI分析]
api/analyze.js → 后端返回 { aiType, tags[], summary, vectorId }
  ↓
analyze-result 展示 → 用户[确认保存]
  ↓
storage.addClip({...扩展字段}) → 写入本地
  ↓
clip-card 自动插入首页列表顶部
```

---

## 六、pages.json 注册

```json
{
  "pages": [
    { "path": "pages/index/index", "style": { "navigationBarTitleText": "ClipMemo" }},
    { "path": "pages/detail/detail", "style": { "navigationBarTitleText": "详情" }},
    { "path": "pages/settings/settings", "style": { "navigationBarTitleText": "设置" }}
  ]
}
```
