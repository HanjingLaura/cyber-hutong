export async function bailianComplete({ system, user }, options) {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw Object.assign(new Error('未配置 DASHSCOPE_API_KEY'), { code: 'NO_API_KEY' });
  const body = {
    model: options.model || 'qwen-turbo',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    max_tokens: options.maxTokens || 120,
    enable_thinking: options.enableThinking === true,
  };
  return request(body, options, true);
}

async function request(body, options, canRetry) {
  let response;
  try {
    response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw Object.assign(new Error('百炼暂时没有连上'), { code: 'NETWORK' });
  }
  if (!response.ok) {
    const detail = await response.text();
    if (canRetry && response.status === 400 && /enable_thinking/i.test(detail)) {
      const { enable_thinking, ...rest } = body;
      return request(rest, options, false);
    }
    if (response.status === 401) throw Object.assign(new Error('百炼密钥无效'), { code: 'BAD_KEY' });
    throw Object.assign(new Error('百炼没有返回对白'), { code: 'UPSTREAM' });
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw Object.assign(new Error('模型没有给出对白'), { code: 'EMPTY' });
  }
  return content;
}
