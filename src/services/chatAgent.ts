/* ============================================================
   AI 对话助手（智能体式对话窗口）
   - 多轮对话（消息历史上下文）
   - RAG 增强：每轮自动检索赛题知识库注入
   - 可选注入当前质询项目上下文
   - 未配置 key / 失败时返回 null（界面提示去设置页配置）
   ============================================================ */
import { chatStream, getLLMConfig, LLMError } from './llm'
import { searchKB, formatKBContext } from './rag'
import type { ChatMessage } from './llm'
import type { Project } from '@/types/engine'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  /** 多模态：图片附件（data URL，最多 4 张） */
  images?: string[]
}

export interface ChatAgentResult {
  /** 回复文本；LLM 未启用或失败时为 null */
  text: string | null
  /** 当发送图片但当前模型不支持视觉时给出提示 */
  visionWarn?: string
}

/** 常见视觉模型关键词（用于提示切换） */
const VISION_HINTS = ['vl', 'vision', '4o', 'gpt-4', 'gemini', 'llava', 'glm-4v', 'qwen-vl', 'internvl', 'minicpm-v']

function isVisionModel(model: string): boolean {
  const m = model.toLowerCase()
  return VISION_HINTS.some((k) => m.includes(k))
}

function buildSystemPrompt(project: Project | null, kbContext: string): string {
  const lines = [
    '你是「AI刁钻评委」内置的 AI 助手——一个面向大学生创新创业项目的智能评审顾问，像智能体一样可以连续对话。',
    '',
    '你能做的事：',
    '1. 解答关于创新创业大赛、评审标准、答辩技巧的问题；',
    '2. 帮助选手打磨回答表达、分析项目漏洞、规划改进方向；',
    '3. 解释质询报告中的术语与建议；',
    '4. 给出可执行的具体建议（谁 + 做什么 + 怎么做）；',
    '5. 当用户发送图片（截图、照片、图纸、数据表等）时，仔细观察图片内容并结合上下文回答。',
    '',
    '铁律：',
    '1. 绝不虚构任何数据（实验结果、样本量、识别率、用户量、合作方）；项目资料没有的量化结果，只能说"缺失/待验证"并建议怎么补。',
    '2. 回答简洁、直接、专业，不说空话套话；不确定时明确说"这一点我无法确定"。',
    '3. 涉及官方赛题/评分标准时，以下方检索到的知识库内容为准，不要凭记忆编造。',
    '',
    kbContext
  ]
  if (project) {
    lines.push(
      '',
      '【当前正在质询的项目】',
      '名称：' + (project.name || '（未填写）'),
      project.brief ? '简介：' + project.brief : '',
      project.tech ? '技术方案：' + project.tech : '',
      project.progress ? '目前进展：' + project.progress : '',
      project.data ? '已有数据：' + project.data : '',
      '',
      '选手可能会问这个项目的具体问题，请结合以上资料回答；资料里没有的信息不要编造。'
    )
  }
  return lines.filter((l) => l !== '').join('\n')
}

/**
 * 助手回复：注入系统提示 + RAG 检索 + 历史消息（支持图片多模态），流式生成。
 * @returns 回复结果；LLM 未启用或失败时 text 为 null
 */
export async function chatAgentReply(
  history: ChatMsg[],
  project: Project | null,
  onToken?: (token: string) => void
): Promise<ChatAgentResult> {
  if (!getLLMConfig().enabled) return { text: null }

  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content || ''
  const kbContext = formatKBContext(searchKB(lastUser, 3))

  const hasImages = history.some((m) => m.images && m.images.length > 0)
  const model = getLLMConfig().model
  if (hasImages && !isVisionModel(model)) {
    return {
      text: null,
      visionWarn:
        '当前模型（' +
        model +
        '）是纯文本模型，不支持看图。请在「设置」页切换到视觉模型，例如智谱 glm-4v-plus、通义 qwen-vl-plus 或 GPT-4o。'
    }
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(project, kbContext) },
    ...history.map((h): ChatMessage => {
      if (h.role === 'assistant') return { role: 'assistant', content: h.content }
      if (h.images && h.images.length) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: h.content || '请仔细查看图片并给出分析。' },
            ...h.images.map((img) => ({ type: 'image_url', image_url: { url: img } }))
          ]
        } as unknown as ChatMessage
      }
      return { role: 'user', content: h.content }
    })
  ]

  try {
    const text = await chatStream(messages, {
      timeoutMs: 60000,
      temperature: 0.6,
      onToken
    })
    return { text }
  } catch (e) {
    console.warn('[chatAgent] 对话失败：', e instanceof LLMError ? e.message : e)
    return { text: null }
  }
}
