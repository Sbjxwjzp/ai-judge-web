/* ============================================================
   Function Calling 工具集 — AI 深度评审报告
   工具 1：search_contest_kb     检索官方赛题知识库
   工具 2：score_against_standards  按官方评分标准评估
   由 LLM 在第一轮自主决策调用，结果送回后流式生成最终报告
   ============================================================ */
import type { ToolDef } from './llm'
import { searchKB, formatKBContext } from './rag'

export const CONTEST_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'search_contest_kb',
      description:
        '检索《全国高校AI Web开发挑战赛》官方赛题知识库（命题背景、推荐方向、评分标准权重、AI技术深度六项考察点、提交要求、数据红线）。当需要对照官方评分标准、考察点或比赛要求来评审项目时，务必先调用本工具核对。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索关键词，例如"AI技术深度 评分标准"或"RAG 考察点"' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'score_against_standards',
      description:
        '按《全国高校AI Web开发挑战赛》官方评分维度给出评估：AI技术深度35%（大模型集成8 / Agent与工作流8 / RAG 6 / 多模态5 / 安全可控4 / MCP与工具集成4）、创新性25%、前端工程质量10%、实用性10%、用户体验10%、社会价值与商业潜力10%。返回各维度得分区间（0-100）与一句依据。',
      parameters: {
        type: 'object',
        properties: {
          focus: { type: 'string', description: '重点评估的方向，例如"AI技术深度"或"整体"' }
        },
        required: ['focus']
      }
    }
  }
]

async function execSearchKb(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query || '评分标准').trim()
  const hits = searchKB(query, 3)
  if (!hits.length) return '（知识库未命中，请换关键词重试）'
  return formatKBContext(hits)
}

async function execScore(args: Record<string, unknown>): Promise<string> {
  const focus = String(args.focus || '整体').trim()
  /* 评分标准文本从知识库检索，保证与官方一致 */
  const hits = searchKB('评分标准 权重 AI技术深度 35% 创新性 25% 前端工程 实用性 用户体验 社会价值 商业潜力', 3)
  const std = formatKBContext(hits)
  return (
    '官方评分维度与权重如下（请严格按此评估）：\n' +
    std +
    '\n重点评估方向：' +
    focus +
    '\n请给出各维度 0-100 的得分区间与依据（结合当前项目实际，不要虚构数据；缺数据的维度要指出）。'
  )
}

export const TOOL_EXECUTOR: Record<
  string,
  (args: Record<string, unknown>) => Promise<string>
> = {
  search_contest_kb: execSearchKb,
  score_against_standards: execScore
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const fn = TOOL_EXECUTOR[name]
  if (!fn) return '（未知工具：' + name + '）'
  try {
    return await fn(args)
  } catch (e) {
    return '（工具执行失败：' + (e instanceof Error ? e.message : String(e)) + '）'
  }
}
