'use strict';

/**
 * clip-analyze 云函数
 * 调用 Kimi (moonshot-v1-8k) 对剪贴内容进行 AI 分析
 * 输入：content（文本）、types（可选类型库）
 * 输出：aiType、dataSource、description、keywords
 */
exports.main = async (event, context) => {
  const { content, types } = event;

  if (!content || !content.trim()) {
    return { code: 400, msg: '缺少 content 参数' };
  }

  // 构建类型库描述，供 AI 优先匹配
  let typeList = '';
  if (types && typeof types === 'object') {
    typeList = Object.entries(types)
      .map(([key, val]) => `"${key}"（${val.label}）`)
      .join('、');
  }
  if (!typeList) {
    typeList = '无预设类型，请根据内容自行判断';
  }

  const systemPrompt = `你是一个剪贴内容分析助手。请分析用户提供的剪贴内容，并以 JSON 格式返回分析结果。

分析要求：
1. **aiType**：从下列可选类型中选一个最匹配的作为值：${typeList}。若都不匹配，可根据内容自定义一个新的类型名（英文 key 形式，如 "code"、"json"、"address" 等）。
2. **dataSource**：推测该内容的数据来源（如：微信、网页、邮件、短信、代码编辑器、备忘录、Excel 等）。
3. **description**：50 字以内的内容摘要描述，简洁概括内容是什么、做什么的。
4. **keywords**：3-5 个用于检索的关键词数组。

请严格只返回如下格式的 JSON，不要包含任何额外文字或 markdown 标记：
{"aiType":"...","dataSource":"...","description":"...","keywords":["...","..."]}`;

  try {
    const response = await uniCloud.httpclient.request(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-gCkDC7aS5IlXTPfEqUreRAkX7d2LBrCShWNWqYv88rz2fOqF',
        },
        data: {
          model: 'moonshot-v1-8k',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: content },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        dataType: 'json',
      }
    );

    const aiMessage = response.data.choices[0].message.content;

    // 解析 AI 返回的 JSON
    let result;
    try {
      // 兼容可能包裹在 ```json ... ``` 中的情况
      const jsonStr = aiMessage.replace(/```json\s*|```/g, '').trim();
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('AI 返回内容解析失败:', aiMessage);
      return { code: 500, msg: 'AI 返回内容解析失败，请重试' };
    }

    return {
      code: 0,
      data: {
        aiType: result.aiType || 'text',
        dataSource: result.dataSource || '未知',
        description: result.description ? result.description.slice(0, 50) : '',
        keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 5) : [],
      },
    };
  } catch (e) {
    console.error('AI分析请求失败:', e);
    return { code: 500, msg: 'AI 分析请求失败: ' + (e.message || '未知错误') };
  }
};
