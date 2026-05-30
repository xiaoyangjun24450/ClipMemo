# ClipMemo 技术实现方案

## 一、整体流程

用户复制 → 回到 APP 前台时检测剪贴板变化 → 弹窗确认 → 后端分析 → 入库 → 检索回写

---

## 二、前端方案

### 3.1 数据模型扩展
现有 storage.js 仅存 content/type/time/id，需扩展为：
  id, content, rawType, aiType, tags[], summary, vectorId, copyCount,
  lastCopyTime, createdAt, isEncrypted, sourceUrl, metadata{}

敏感类（密码/身份证/银行卡）标记 isEncrypted=true，写入前 AES 加密，密钥存本地 Keychain/Keystore。

### 3.2 本地类型识别（不联网）
纯 JS 正则引擎，在入库前静默运行，识别以下类型：
  手机号：/^1[3-9]\d{9}$/
  邮箱：/^[\w.-]+@[\w.-]+\.\w+$/
  身份证：/^\d{17}[\dXx]$/
  银行卡：/^\d{16,19}$/
  地址：省/市/区/路/街/号关键词组合匹配
  URL：/^https?:\/\/.+/
  密码类：含 password/secret/token/key 等词，或高熵短字符串

识别结果暂存 rawType 字段，用作弹窗预览的初步分类标签。

### 3.3 入库确认流程
检测到新内容 → 本地匹配 rawType → 弹出半屏卡片：
  "[rawType 图标] 检测到新内容：[前30字预览]..."
  [存入并分析] [仅本地保存] [忽略]

选择"存入并分析"：调后端 /api/analyze 进行 AI 处理。
选择"仅本地保存"：跳过云端，直接加密存手机。
选择"忽略"：丢弃。

### 3.4 搜索模块
前端搜本地已缓存的 tags/content 做即时筛选；语义搜索走后端 /api/search。
搜索栏支持输入时 200ms 防抖，同时调本地模糊匹配（即时反馈）和后端语义搜索（250ms 后返回融合结果）。

### 3.5 写回剪贴板 + 频次
调用 uni.setClipboardData，成功后本地 copyCount++ 并调 /api/track 记录。列表排序权重 = copyCount * 0.4 + recency * 0.3 + 语义匹配 * 0.3。

### 3.6 页面规划
  pages/index/index.vue：主列表页（时间线 + 搜索栏 + 类型筛选tab）
  pages/detail/detail.vue：详情页（完整内容 + 标签编辑 + AI摘要 + 计数）
  pages/settings/settings.vue：设置（监控开关 + 导出 + 清空）

---

## 四、后端方案（Node.js / Python，建议 FastAPI）

### 4.1 接口设计
POST /api/analyze
  入参：{ content, rawType, sourceUrl? }
  处理：类型二次确认 → 链接抓取 → 关键词提取 → 摘要生成 → 向量化
  返回：{ aiType, tags[], summary, vectorId }

POST /api/search
  入参：{ query, topK?, filterType? }
  处理：query 向量化 → 向量库查 topK → 回表拼接详情 → 融合本地频次排序
  返回：{ results: [{id, content, type, tags, summary, copyCount, score}] }

POST /api/track
  入参：{ id }
  处理：对应记录 copyCount++

POST /api/fetch-url
  入参：{ url }
  处理：服务端抓取（Puppeteer / Playwright）目标页面标题+正文
  针对小红书/公众号等反爬站点，需要 UA 伪装 + cookie 维持

### 4.2 分析流水线
收到内容后顺序执行：

Step1 类型确认：调 LLM 传入 rawType+content，返回最终分类。
  敏感类型（密码/身份证）直接拒绝分析，返回提示前端仅本地加密存储。

Step2 链接抓取：若 rawType=URL 且非敏感，用 headless browser 抓取页面，
  对主流平台（小红书/公众号/知乎/微博）做定制解析 extractor。

Step3 关键词提取：调 LLM 或专用 NLP 模型（如 jieba + TF-IDF / KeyBERT），
  输出 3-8 个关键词，过滤掉无意义虚词。

Step4 摘要生成：若 content > 200字 或为抓取后的文章正文，
  调 LLM 生成 80-150 字的结构化摘要。

Step5 向量嵌入：用 Embedding 模型（OpenAI text-embedding-3-small 或
  本地 bge-large-zh）将「标题+关键词+摘要」拼接后向量化，写入向量库。

### 4.3 存储选型
PostgreSQL 存结构化数据（内容/类型/标签/摘要/计数）。
pgvector 扩展存向量，HNSW 索引加速检索。
Redis 缓存高频搜索结果，降低向量计算开销。

### 4.4 语义检索实现
用户 query → 同一 Embedding 模型向量化 → pgvector 做 cosine 相似度查
topK=20 → 结果按 (相似度*0.7 + 归一化copyCount*0.3) 重排 → 返回 top10。

---

## 五、安全与隐私边界

本地识别不上传：密码/身份证/银行卡在手机端正则识别后加密本地存储，永不传输。

云端仅处理确认后的内容：analyze 接口只在用户明确点击"存入并分析"后调用。

传输加密：HTTPS + 敏感字段 AES-256 加密。

数据删除权：/api/delete 清空云端数据，本地可一键清空。

---

## 六、实施计划

Phase1（2周）：扩展 storage 数据模型 + 本地正则识别 + 入库弹窗 + 搜索列表页 + 复制计数 + 通知栏已有基础。

Phase2（3周）：搭建 FastAPI 后端 + analyze 流水线（LLM 分类/关键词/摘要）+ pgvector 向量检索 + 链接抓取。

Phase3（1周）：加密存储 + 数据导出 + 智能排序优化 + 隐私开关。
