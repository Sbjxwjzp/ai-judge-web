/* ============================================================
   LLM 客户端（OpenAI 兼容接口）
   - 支持任意 OpenAI 兼容 API：DeepSeek / 智谱 / 通义 / Moonshot / OpenAI
   - 流式（SSE）与非流式
   - 配置来自环境变量（import.meta.env），key 绝不进入代码/仓库
   - 未配置 key 时 enabled=false，调用方应降级为纯规则引擎
   ============================================================ */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** tool 消息：关联的 tool_call id */
  tool_call_id?: string
  /** assistant 消息：第一轮决策返回的工具调用 */
  tool_calls?: unknown[]
}

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
  enabled: boolean
}

function readConfig(): LLMConfig {
  const apiKey = (import.meta.env.VITE_LLM_API_KEY as string) || ''
  const baseUrl = (
    (import.meta.env.VITE_LLM_BASE_URL as string) || 'https://api.deepseek.com/v1'
  ).replace(/\/+$/, '')
  const model = (import.meta.env.VITE_LLM_MODEL as string) || 'deepseek-chat'
  /* 占位符（含中文/非 ASCII）视为未配置，避免误发请求 */
  const looksReal = apiKey.length > 0 && !/[^\x00-\x7F]/.test(apiKey)
  const enabled = looksReal && (import.meta.env.VITE_LLM_ENABLED as string) !== 'false'
  return { apiKey, baseUrl, model, enabled }
}

export const llmConfig: LLMConfig = readConfig()

export class LLMError extends Error {}

export interface LLMOptions {
  json?: boolean
  timeoutMs?: number
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
}

/** OpenAI 兼容 Function 工具定义 */
export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface StreamOptions extends LLMOptions {
  onToken?: (token: string) => void
}

interface RequestOptions extends LLMOptions {
  stream: boolean
  tools?: ToolDef[]
}

async function request(messages: ChatMessage[], opts: RequestOptions): Promise<Response> {
  if (!llmConfig.enabled) throw new LLMError('LLM 未启用（缺少 VITE_LLM_API_KEY）')
  const body: Record<string, unknown> = {
    model: llmConfig.model,
    messages,
    stream: opts.stream,
    temperature: opts.temperature ?? 0.4
  }
  if (opts.json) body.response_format = { type: 'json_object' }
  if (opts.maxTokens) body.max_tokens = opts.maxTokens
  if (opts.tools && opts.tools.length) body.tools = opts.tools

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000)
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort()
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true })
  }

  let resp: Response
  try {
    resp = await fetch(llmConfig.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + llmConfig.apiKey
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new LLMError('LLM 请求超时')
    }
    /* 网络错误自动重试一次 */
    try {
      resp = await fetch(llmConfig.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + llmConfig.apiKey
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      })
    } catch (e2) {
      throw new LLMError('LLM 网络错误：' + (e2 instanceof Error ? e2.message : String(e2)))
    }
  } finally {
    clearTimeout(timer)
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new LLMError(`LLM API ${resp.status}: ${text.slice(0, 200)}`)
  }
  return resp
}

/**
 * 流式对话：逐 token 回调，返回完整文本。
 * 若接口不支持流式或流中途失败，抛出 LLMError。
 */
export async function chatStream(
  messages: ChatMessage[],
  opts: StreamOptions = {}
): Promise<string> {
  const resp = await request(messages, { ...opts, stream: true })
  const reader = resp.body?.getReader()
  if (!reader) throw new LLMError('LLM 响应无 body')

  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const obj = JSON.parse(payload)
        const delta: string = obj.choices?.[0]?.delta?.content || ''
        if (delta) {
          full += delta
          opts.onToken?.(delta)
        }
      } catch {
        /* 忽略不完整的 SSE 行 */
      }
    }
  }
  return full
}

/** 非流式对话（json 模式自动附加 response_format） */
export async function chat(messages: ChatMessage[], opts: LLMOptions = {}): Promise<string> {
  const resp = await request(messages, { ...opts, stream: false })
  const data = await resp.json()
  const content: string | undefined = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new LLMError('LLM 响应缺少 content')
  return content
}

/** 从 LLM 输出中稳健提取 JSON（容忍 markdown 代码块包裹） */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new LLMError('LLM 输出不是合法 JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export interface ToolCallMsg {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/**
 * Function Calling 对话：
 * 第一轮带 tools 让模型决策（可能返回 tool_calls）→ 执行工具 →
 * 第二轮把工具结果送回，流式生成最终回复。
 * 若模型第一轮直接回答（未调用工具），直接返回该回答。
 */
export async function chatWithTools(
  messages: ChatMessage[],
  tools: ToolDef[],
  executor: (name: string, args: Record<string, unknown>) => Promise<string>,
  opts: StreamOptions = {}
): Promise<string> {
  if (!llmConfig.enabled) throw new LLMError('LLM 未启用（缺少 VITE_LLM_API_KEY）')

  /* 第一轮：非流式，拿决策（回答或 tool_calls） */
  const resp1 = await request(messages, { ...opts, stream: false, tools })
  const data1 = await resp1.json()
  const msg1 = data1.choices?.[0]?.message
  const toolCalls: ToolCallMsg[] = msg1?.tool_calls || []
  const content1: string = msg1?.content || ''

  if (!toolCalls.length) {
    if (typeof content1 !== 'string' || !content1) throw new LLMError('LLM 无有效回复')
    return content1
  }

  /* 执行工具 */
  const toolMsgs: ChatMessage[] = []
  for (const tc of toolCalls) {
    let args: Record<string, unknown> = {}
    try {
      args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
    } catch {
      /* 参数解析失败时传空对象 */
    }
    const result = await executor(tc.function.name, args)
    toolMsgs.push({ role: 'tool', content: result })
  }

  /* 第二轮：流式生成最终回复（把 assistant 消息与工具结果送回） */
  const round2 = [
    ...messages,
    { role: 'assistant' as const, content: content1, tool_calls: toolCalls } as ChatMessage,
    ...toolMsgs
  ]
  return chatStream(round2, opts)
}
