/* ============================================================
   AI 深度评审报告
   实现方式：前端预检索（RAG）+ 单轮流式生成（稳定优先）
   - 官方评分标准与考察点由本地知识库检索注入 Prompt
   - 避免多轮 Function Calling 在不同模型间的兼容差异
   - 工具定义与执行器保留在 services/tools.ts（可选 Agent 模式）
   ============================================================ */
import { chatStream, getLLMConfig, LLMError } from './llm'
import { searchKB, formatKBContext } from './rag'
import type { Session } from '@/types/engine'

const SCORE_BRIEF =
  '官方评分权重：AI技术深度 35%（大模型集成8 / Agent与工作流8 / RAG 6 / 多模态5 / 安全可控4 / MCP与工具集成4）、' +
  '创新性 25%（选题10 / 技术方案8 / 交互模式7）、前端工程质量 10%、实用性 10%、用户体验 10%、社会价值与商业潜力 10%。'

function buildDeepReportSystem(): string {
  return [
    '你是「AI刁钻评委」的资深评审委员会主席，为大学生创新创业项目撰写《AI 深度评审报告》。',
    '',
    '写作要求：',
    '1. 下方提供了官方赛题评分标准与考察点（已从知识库检索），评审必须严格对照这些标准，不要凭记忆编造。',
    '2. 直接输出报告正文（不要 JSON、不要 markdown 标题符号、不要任何工具调用标记）。',
    '',
    '铁律：',
    '1. 绝不虚构任何数据（实验结果、样本量、识别率、用户量、合作方）。项目资料没有的量化结果，只能标注"缺失/待验证"。',
    '2. 分数是"评估区间+依据"，不是精确成绩；明确注明这是模拟评审，不是官方评分。',
    '3. 报告要可执行：每个问题后面跟"怎么补"。',
    '4. 语言直接、专业、中文。',
    '',
    '报告结构（按此顺序）：',
    '一、总体判断（3-5 句）',
    '二、对照官方评分标准逐维分析（每维：当前状态 → 差距 → 怎么补）',
    '三、三大最紧迫风险（按优先级，各配一句补救建议）',
    '四、答辩准备清单（5-8 条具体待办）'
  ].join('\n')
}

function buildDeepReportUser(session: Session, kbContext: string): string {
  const p = session.project
  const rounds = session.rounds.map((r) => {
    return `【第${r.no}轮${r.q.isFollowUp ? '（追问）' : ''}】问题（${r.q.dim}·${r.q.topic}）：${r.q.text}\n回答：${r.answer}\n判定：${r.critique.verdict}（完整度 ${r.critique.completeness}%）`
  })

  const dimLines = Object.entries(session.dims).map(
    ([name, d]) => `${name}: ${d.score}分（${d.notes.join('；') || '未触及'}）`
  )

  return [
    '【项目资料】',
    '名称：' + (p?.name || '（未填写）'),
    '简介：' + (p?.brief || '（未填写）'),
    p?.tech ? '技术方案：' + p.tech : '',
    p?.progress ? '目前进展：' + p.progress : '',
    p?.data ? '已有数据：' + p.data : '',
    '',
    '【本次模拟质询记录】共 ' + session.rounds.length + ' 轮',
    ...rounds,
    '',
    '【规则引擎汇总】',
    '维度分：' + dimLines.join(' | '),
    '风险计数：' + session.risks.length + ' 个（高优先级 ' + session.risks.filter((r) => r.sev === 'h').length + '）',
    '',
    '【官方评分标准参考】' + SCORE_BRIEF,
    '',
    kbContext,
    '',
    '请对照以上官方评分标准，输出《AI 深度评审报告》正文。'
  ]
    .filter((l) => l !== '')
    .join('\n')
}

/** 清理模型可能输出的工具调用标记（DSML 等），保证报告为纯文本 */
function cleanReportText(text: string): string {
  return text
    .replace(/<\|+\s*DSML\s*\|+[\s\S]*?<\/\|+\s*DSML\s*\|+[^>]*>/gi, '')
    .replace(/<\/?\|+\s*DSML\s*\|+[^>]*>/gi, '')
    .replace(/<\|+\s*DSML\s*\|+[\s\S]*$/gi, '')
    .trim()
}

/**
 * 生成 AI 深度评审报告（流式）。
 * @returns 报告全文；LLM 未启用或失败时返回 null（界面提示降级）
 */
export async function generateDeepReport(
  session: Session,
  onToken?: (token: string) => void
): Promise<string | null> {
  if (!getLLMConfig().enabled) return null

  /* 前端预检索：官方评分标准与考察点（RAG） */
  const kbContext = formatKBContext(
    searchKB('评分标准 AI技术深度 考察点 权重 前端工程 用户体验 社会价值 商业潜力', 3)
  )

  try {
    const text = await chatStream(
      [
        { role: 'system', content: buildDeepReportSystem() },
        { role: 'user', content: buildDeepReportUser(session, kbContext) }
      ],
      { timeoutMs: 120000, temperature: 0.4, onToken }
    )
    return cleanReportText(text)
  } catch (e) {
    console.warn('[deepReport] 生成失败，降级：', e instanceof LLMError ? e.message : e)
    return null
  }
}
