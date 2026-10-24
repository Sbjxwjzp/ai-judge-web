/* ============================================================
   AI 深度评审报告（Function Calling / Agent 工作流）
   用户点「生成 AI 深度评审报告」后：
   1. LLM 自主决定调用工具（查官方赛题知识库 / 按官方评分标准评估）
   2. 工具结果送回 LLM
   3. 流式生成对标官方评分标准的深度评审报告
   ============================================================ */
import { chatWithTools, llmConfig, LLMError } from './llm'
import { CONTEST_TOOLS, executeTool } from './tools'
import type { Session } from '@/types/engine'

const SCORE_BRIEF =
  '官方评分权重：AI技术深度 35%（大模型集成8 / Agent与工作流8 / RAG 6 / 多模态5 / 安全可控4 / MCP与工具集成4）、' +
  '创新性 25%（选题10 / 技术方案8 / 交互模式7）、前端工程质量 10%、实用性 10%、用户体验 10%、社会价值与商业潜力 10%。'

function buildDeepReportSystem(): string {
  return [
    '你是「AI刁钻评委」的资深评审委员会主席，为大学生创新创业项目撰写《AI 深度评审报告》。',
    '',
    '工作方式：',
    '1. 对照官方评分标准评审本项目时，先调用 search_contest_kb 核对官方考察点（不要凭记忆）。',
    '2. 需要给出维度得分时，调用 score_against_standards 获取官方权重后评估。',
    '3. 最终以流式文本输出完整报告（不要 JSON，不要 markdown 标题符号）。',
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

function buildDeepReportUser(session: Session): string {
  const p = session.project
  const rounds = session.rounds.map((r) => {
    return `【第${r.no}轮${r.q.isFollowUp ? '（追问）' : ''}】问题（${r.q.dim}·${r.q.topic}）：${r.q.text}\n回答：${r.answer}\n判定：${r.critique.verdict}（完整度 ${r.critique.completeness}%）`
  })

  const dims = session.dims
  const dimLines = Object.entries(dims).map(
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
    '风险计数：' +
      session.risks.length +
      ' 个（高优先级 ' +
      session.risks.filter((r) => r.sev === 'h').length +
      '）',
    '',
    '【官方评分权重参考】' + SCORE_BRIEF,
    '',
    '请调用工具核对标准后，输出《AI 深度评审报告》。'
  ]
    .filter((l) => l !== '')
    .join('\n')
}

/**
 * 生成 AI 深度评审报告（流式）。
 * @returns 报告全文；LLM 未启用或失败时返回 null（界面提示降级）
 */
export async function generateDeepReport(
  session: Session,
  onToken?: (token: string) => void
): Promise<string | null> {
  if (!llmConfig.enabled) return null
  try {
    return await chatWithTools(
      [
        { role: 'system', content: buildDeepReportSystem() },
        { role: 'user', content: buildDeepReportUser(session) }
      ],
      CONTEST_TOOLS,
      executeTool,
      { timeoutMs: 120000, temperature: 0.4, onToken }
    )
  } catch (e) {
    console.warn('[deepReport] 生成失败，降级：', e instanceof LLMError ? e.message : e)
    return null
  }
}
