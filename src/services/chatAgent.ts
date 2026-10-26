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
}

function buildSystemPrompt(project: Project | null, kbContext: string): string {
  const lines = [
    '你是「AI刁钻评委」内置的 AI 助手——一个面向大学生创新创业项目的智能评审顾问，像智能体一样可以连续对话。',
    '',
    '你能做的事：',
    '1. 解答关于创新创业大赛、评审标准、答辩技巧的问题；',
    '2. 帮助选手打磨回答表达、分析项目漏洞、规划改进方向；',
    '3. 解释质询报告中的术语与建议；',
    '4. 给出可执行的具体建议（谁 + 做什么 + 怎么做）。',
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
 * 助手回复：注入系统提示 + RAG 检索 + 历史消息，流式生成。
 * @returns 完整回复文本；LLM 未启用或失败时返回 null
 */
export async function chatAgentReply(
  history: ChatMsg[],
  project: Project | null,
  onToken?: (token: string) => void
): Promise<string | null> {
  if (!getLLMConfig().enabled) return null

  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content || ''
  const kbContext = formatKBContext(searchKB(lastUser, 3))

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(project, kbContext) },
    ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }))
  ]

  try {
    return await chatStream(messages, {
      timeoutMs: 60000,
      temperature: 0.6,
      onToken
    })
  } catch (e) {
    console.warn('[chatAgent] 对话失败：', e instanceof LLMError ? e.message : e)
    return null
  }
}
