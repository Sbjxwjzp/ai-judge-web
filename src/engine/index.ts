/* ============================================================
   AI刁钻评委 — 质询引擎（纯逻辑，不依赖 DOM）
   - buildChain: 组装质询链（示例项目用专用链，自定义项目用通用链+视觉增强）
   - createSession / currentQuestion / submit
   - 回答分析（证据识别 → 问题清单 → 评分 → 追问决策）
   - buildReport: 风险总结 + 改进建议
   ============================================================ */
import type {
  Project,
  Question,
  Session,
  Round,
  Critique,
  Issue,
  RiskItem,
  SubmitResult,
  ProgressInfo,
  Report
} from '@/types/engine'
import {
  LEX,
  REVIEW_DIMS,
  RISK_KINDS,
  DIM_META,
  ICAN_SCENE,
  DISCLAIMER,
  SAMPLE_PROJECT
} from '@/data/core'
import { DEMO_CHAIN_PART1 } from '@/data/demo1'
import { DEMO_CHAIN_PART2 } from '@/data/demo2'
import { GENERIC_CHAIN, GENERIC_VISION } from '@/data/generic'
import { MOCK_FOLLOW, MOCK_FOLLOW_GENERIC } from '@/data/mock'

export const DIM_WEIGHTS: Record<string, Record<string, number>> = {
  创新性: { 创新性: 1 },
  技术实现: { 技术实现: 1 },
  AI能力: { 技术实现: 0.5, 创新性: 0.5 },
  实用价值: { 实用价值: 1 },
  用户体验: { 用户体验: 1 },
  数据与验证: { 展示效果: 0.5, 技术实现: 0.5 },
  异常场景: { 技术实现: 0.5, 展示效果: 0.5 },
  不确定度与鲁棒性: { 技术实现: 1 }
}

export const VISION_KEYWORDS = [
  '视觉',
  '摄像头',
  '相机',
  '图像',
  '画面',
  '识别',
  '检测',
  'maixcam',
  'cv',
  'yolo'
]

const MAX_FOLLOWUP_PER_STAGE = 1
const BASELINE = 62

/* ---------------- 工具 ---------------- */
function norm(s: unknown): string {
  return (s || '').toString()
}
function lower(s: unknown): string {
  return norm(s).toLowerCase()
}
function hasAny(text: unknown, words: string[]): boolean {
  const t = lower(text)
  for (let i = 0; i < words.length; i++) {
    if (t.indexOf(lower(words[i])) >= 0) return true
  }
  return false
}
function hasNumber(text: unknown): boolean {
  return (
    /[0-9０-９]/.test(norm(text)) ||
    /[一二三四五六七八九十百千万]+\s*(次|组|帧|秒|分|小时|元|毫米|厘米|米|像素)/.test(norm(text))
  )
}

/* ---------------- 模拟回答 ---------------- */
export function mockOf(q: Question | null, project: Project | null): string {
  if (!q) return ''
  if (typeof q.mock === 'function') return q.mock(project || {})
  return q.mock || ''
}

function mockForFollowUp(parent: Question, type: string | null, project: Project | null): string {
  const gen = MOCK_FOLLOW_GENERIC
  const own = MOCK_FOLLOW[parent.id]
  const t = type || 'gap'
  if (own && own[t as keyof typeof own]) return own[t as keyof typeof own]
  if (gen[t as keyof typeof gen]) return gen[t as keyof typeof gen]
  return mockOf(parent, project)
}

/* ---------------- 组装质询链 ---------------- */
export function buildChain(project: Project | null): Question[] {
  const demoChain = DEMO_CHAIN_PART1.concat(DEMO_CHAIN_PART2)
  if (project && project.id === 'car-ball') {
    return demoChain.slice()
  }
  const gen = GENERIC_CHAIN.slice()
  const vis = GENERIC_VISION.slice()
  const blob = lower(
    [
      project && project.name,
      project && project.brief,
      project && project.tech,
      project && project.progress,
      project && project.background,
      project && project.data
    ].join(' ')
  )
  const isVision = hasAny(blob, VISION_KEYWORDS)
  if (!isVision) return gen
  /* 视觉相关项目：把视觉专项题插到"系统架构"之后 */
  const out: Question[] = []
  gen.forEach((q) => {
    out.push(q)
    if (q.id === 'GB3') vis.forEach((v) => out.push(v))
  })
  return out
}

export function isVisionProject(project: Project | null): boolean {
  const blob = lower(
    [
      project && project.name,
      project && project.brief,
      project && project.tech,
      project && project.progress,
      project && project.background,
      project && project.data
    ].join(' ')
  )
  return hasAny(blob, VISION_KEYWORDS)
}

/* ---------------- 会话 ---------------- */
export function createSession(project: Project | null): Session {
  const chain = buildChain(project)
  const dims: Session['dims'] = {}
  REVIEW_DIMS.forEach((d) => {
    dims[d] = { score: BASELINE, notes: [], touched: false }
  })
  return {
    project,
    chain,
    queue: chain.slice(),
    stage: 0,
    totalStages: chain.length,
    followUpsThisStage: 0,
    rounds: [],
    risks: [],
    dims,
    finished: false,
    startedAt: Date.now(),
    isVision: isVisionProject(project)
  }
}

export function currentQuestion(state: Session): Question | null {
  if (state.finished) return null
  return state.queue[0] || null
}

export function progress(state: Session): ProgressInfo {
  const done = state.rounds.filter((r) => !r.q.isFollowUp).length
  return { done, total: state.totalStages, round: state.rounds.length + 1 }
}

/* ---------------- 回答分析 ---------------- */
export function analyze(state: Session, q: Question, text: string): Critique {
  const t = norm(text)
  const issues: Issue[] = []
  const matched: string[] = []
  const missing: string[] = []

  if (q.keys && q.keys.length) {
    q.keys.forEach((k) => {
      if (hasAny(t, k.words)) matched.push(k.label)
      else missing.push(k.label)
    })
  }
  const paramMissing: string[] = []
  ;(q.params || []).forEach((p) => {
    if (!hasAny(t, p.words)) paramMissing.push(p.label)
  })

  const mustCoverFail = !!(q.mustCover && q.mustCover.words && !hasAny(t, q.mustCover.words))
  const totalKeys = (q.keys || []).length
  const matchedRatio = totalKeys ? matched.length / totalKeys : t.length > 40 ? 0.7 : 0.3
  const hasNum = hasNumber(t)
  const vague = hasAny(t, LEX.vague)
  const absolute = hasAny(t, LEX.absolute)
  const effect = hasAny(t, LEX.effect)
  const mitigate = hasAny(t, LEX.mitigation)
  const short = t.replace(/\s/g, '').length < 18

  /* --- 规则 1：压根没答 --- */
  if (short) {
    issues.push(
      mkIssue(
        'evidence',
        'h',
        '回答信息量不足',
        '目前的回答没有给出可以被评审使用的信息，这一段在答辩里会被认为"没有回答"。',
        '评委只能根据你说出来的内容打分，没说出来的一律按没有处理。',
        ['能不能先给一个结论，再说你的依据？']
      )
    )
  }

  /* --- 规则 2：关键证据缺失 --- */
  if (!short && missing.length && matchedRatio < 0.67) {
    issues.push(
      mkIssue(
        'evidence',
        matched.length ? 'm' : 'h',
        '关键证据缺失：' + missing.join('、'),
        '这类问题的评审要看的是"依据"，而不是"结论"。回答里缺少：' + missing.join('、') + '。',
        '缺证据的结论在现场只能算口头声明，无法支撑评分。',
        ['这个依据你目前有没有？如果没有，你打算怎么补？']
      )
    )
  }

  /* --- 规则 3：必须正面回答的隐含问题被绕开 --- */
  if (!short && mustCoverFail) {
    issues.push(
      mkIssue(
        'logic',
        'h',
        '没有正面回答：' + (q.mustCover ? q.mustCover.ask : '隐含问题'),
        '这是本问里最容易被追问的一层，回答绕过去了。评委通常会在你停顿的地方补一刀。',
        '越是没回答的点，越会被反复追问；主动讲出来反而能加分。',
        ['如果我现在就追问这一点，你会怎么答？']
      )
    )
  }

  /* --- 规则 4：关键参数缺失 --- */
  if (!short && paramMissing.length) {
    issues.push(
      mkIssue(
        'param',
        'm',
        '关键参数缺失：' + paramMissing.join('、'),
        '回答里没有出现可核对的数字。评审判断"有没有真做过"的最快方式，就是看能不能报出参数。',
        '参数缺失会让整个方案显得停留在概念阶段。',
        ['这些数字你现在能报出来吗？大概量级也可以。']
      )
    )
  }

  /* --- 规则 5：有结论无量化 --- */
  if (!short && effect && !hasNum) {
    issues.push(
      mkIssue(
        'evidence',
        'm',
        '有结论、无量化',
        '你说到了效果（"能识别""稳定"一类的表述），但没有给出任何可核对的数量或条件。',
        '没有条件与数量的效果描述，在现场会被直接理解为"还没有测"。',
        ['是在什么条件下观察到的？持续了多久？失败过几次？']
      )
    )
  }

  /* --- 规则 6：含糊表述 --- */
  if (!short && vague) {
    issues.push(
      mkIssue(
        'evidence',
        'm',
        '关键表述含糊',
        '回答里出现了"基本""大概""尽量"这类词。它们在口语里无害，但在评审语境里会被理解为"你自己也不确定"。',
        '含糊词是评委判断"这个点还没做实"的信号。',
        ['把这句话换成具体条件或数字，你会怎么说？']
      )
    )
  }

  /* --- 规则 7：绝对化表述 --- */
  if (absolute) {
    issues.push(
      mkIssue(
        'logic',
        'h',
        '绝对化表述',
        '回答里出现了"一定""绝对不会"这类绝对说法。工程问题几乎不存在绝对，这类表述容易被一句话推翻。',
        '被推翻的不是你的能力，而是这句话的可信度；评委会顺势怀疑其他结论。',
        ['有没有一种情况下这句话不成立？']
      )
    )
  }

  /* --- 规则 8：异常题缺少失效处理 --- */
  if (!short && isRiskQuestion(q) && !mitigate) {
    issues.push(
      mkIssue(
        'tech',
        'h',
        '缺少失效处理',
        '这道题问的是"出错时怎么办"，但回答里没有出现任何处理手段（判断、丢弃、重试、降级、保护等）。',
        '异常场景的评分点几乎全在"处理方式"上，没有处理方式就等于没有这一项的答案。',
        ['这一路数据你怎么判断它不可信？不可信之后系统做什么？']
      )
    )
  }

  /* --- 题目自带的高价值专项规则 --- */
  if (typeof q.extra === 'function') {
    try {
      const extra = q.extra(t, state) || []
      extra.forEach((e) => {
        issues.push(mkIssue(e.kind, e.sev || 'm', e.title, e.detail, e.why || '', e.asks))
      })
    } catch {
      /* 规则异常不影响主流程 */
    }
  }

  /* --- 追问题：单独规则 --- */
  if (q.isFollowUp) {
    const plan = hasAny(t, ['计划', '打算', '准备', '将', '后面', '接下来', '以后'])
    const specific = hasAny(t, [
      '因为',
      '主要是',
      '取舍',
      '对比',
      '具体',
      '比如',
      '原因是',
      '按比例',
      '标志位',
      '分组',
      '退回',
      '沿用',
      '带一个'
    ])
    if (!hasNum && !mitigate && !plan && !specific && t.length > 0) {
      issues.push(
        mkIssue(
          'evidence',
          'm',
          '仍然没有落到具体做法',
          '追问之后回答依然是方向性描述，还看不到可执行的步骤或判据。',
          '追问环节评委期待的是"更具体"，重复方向会被判定为回避。',
          ['下一步你具体会怎么做？第一步是什么？']
        )
      )
    } else if (plan && !hasNum) {
      issues.push(
        mkIssue(
          'found',
          'l',
          '停在"计划"层面',
          '回答给出了打算做什么，这是可以接受的，但如果能把判据一起说出来会更好。',
          '评委通常接着会问时间与验收标准。',
          ['这件事你打算什么时候做完？做完怎么算通过？']
        )
      )
    } else if (hasNum || mitigate || specific) {
      issues.push(
        mkIssue(
          'found',
          'l',
          '回答方向正确，可以继续往数字上落',
          '这一轮回答里出现了具体手段或数量，属于有效回应。',
          '继续保持这种"给结论 + 给依据"的结构，是答辩里最省时间的答法。',
          ['这些数字是在什么条件下得到的？']
        )
      )
    }
  }

  /* --- 去重 & 打分 --- */
  const seen: Record<string, number> = {}
  const uniq: Issue[] = []
  issues.forEach((i) => {
    if (!seen[i.title]) {
      seen[i.title] = 1
      uniq.push(i)
    }
  })

  const crit = uniq.filter((i) => i.sev === 'h').length
  const mid = uniq.filter((i) => i.sev === 'm').length

  let completeness = 0
  if (!short) {
    completeness = Math.round(matchedRatio * 70)
    if (q.mustCover && !mustCoverFail) completeness += 20
    if (hasNum) completeness += 10
    completeness = Math.max(5, Math.min(100, completeness))
  }

  const verdict = short
    ? '无有效回答'
    : crit
      ? '存在明显漏洞'
      : mid
        ? '基本可用但证据不足'
        : completeness >= 80
          ? '回答完整'
          : '方向正确、可再压实'

  /* --- 追问决策 --- */
  let nextType: string | null = null
  let nextText = ''
  if (crit === 0 && completeness >= 67 && matchedRatio >= 0.67) {
    nextType = 'deep'
    nextText = q.deepQ || ''
  } else {
    nextType = 'gap'
    nextText = q.gapQ || q.deepQ || ''
  }
  if (!nextText) nextType = null

  return {
    qid: q.id,
    isFollowUp: !!q.isFollowUp,
    completeness,
    matched,
    missing,
    paramMissing,
    issues: uniq,
    verdict,
    criticalCount: crit,
    midCount: mid,
    summary: buildSummary(q, verdict, uniq, completeness),
    suggestions: (q.suggest || []).slice(),
    nextAsks: collectAsks(uniq, q),
    nextType,
    nextText
  }
}

function isRiskQuestion(q: Question): boolean {
  return /异常|失效|遮挡|光照|丢包|冲突|错误|鲁棒|通信|延迟/.test(norm(q.topic) + norm(q.text))
}

function mkIssue(
  kind: string,
  sev: string,
  title: string,
  detail: string,
  why: string,
  asks?: string[],
  bespoke?: boolean
): Issue {
  const meta = RISK_KINDS[kind] || RISK_KINDS.found
  return {
    kind,
    name: meta.name,
    cls: meta.cls,
    sev: sev || meta.sev,
    title,
    detail,
    why: why || '',
    asks: asks || [],
    bespoke: !!bespoke
  }
}

function collectAsks(issues: Issue[], q: Question): string[] {
  const out: string[] = []
  issues.forEach((i) => {
    ;(i.asks || []).forEach((a) => {
      if (out.indexOf(a) < 0) out.push(a)
    })
  })
  if (!out.length && q && q.deepQ) out.push(q.deepQ)
  return out.slice(0, 4)
}

function buildSummary(q: Question, verdict: string, issues: Issue[], completeness: number): string {
  const head =
    '针对「' +
    q.topic +
    '」这一问，你的回答判定为：' +
    verdict +
    '（信息完整度约 ' +
    completeness +
    '%）。'
  if (!issues.length) {
    return head + '这一轮没有发现明显缺口，可以继续往更深的层次追问。'
  }
  const names: string[] = []
  issues.forEach((i) => {
    if (names.indexOf(i.name) < 0) names.push(i.name)
  })
  return (
    head +
    '本次共识别出 ' +
    issues.length +
    ' 个需要处理的地方，集中在：' +
    names.join('、') +
    '。下面逐条说明——为什么它是问题、评委可能怎么追问、你该补什么材料。'
  )
}

/* ---------------- 提交回答 ---------------- */
export function submit(state: Session, text: string, opts?: { isMock?: boolean }): SubmitResult {
  opts = opts || {}
  const q = currentQuestion(state)
  if (!q) return { error: 'no-question' }
  const t = norm(text).trim()
  if (t.replace(/\s/g, '').length < 4) return { error: 'too-short' }

  const critique = analyze(state, q, t)
  const round: Round = {
    no: state.rounds.length + 1,
    q,
    answer: t,
    isMock: !!opts.isMock,
    critique,
    at: Date.now()
  }
  state.rounds.push(round)
  state.queue.shift()
  applyScore(state, q, critique)
  appendRisks(state, q, critique)

  /* 下一步：是否需要插入追问 */
  let nextQ: Question | null = null
  if (
    !q.isFollowUp &&
    critique.nextType &&
    critique.nextText &&
    state.followUpsThisStage < MAX_FOLLOWUP_PER_STAGE
  ) {
    nextQ = {
      id: q.id + '_F',
      dim: q.dim,
      topic: q.topic + '（追问）',
      text: critique.nextText,
      focus: '上一轮回答中被识别出的缺口，继续往下压一层。',
      evidence: [],
      keys: [],
      params: [],
      suggest: (q.suggest || []).slice(),
      isFollowUp: true,
      parentId: q.id,
      followType: critique.nextType,
      deepQ: q.deepQ,
      gapQ: q.gapQ,
      mock: mockForFollowUp(q, critique.nextType, state.project)
    }
    state.queue.unshift(nextQ)
    state.followUpsThisStage += 1
  } else {
    state.followUpsThisStage = 0
    state.stage += 1
  }

  if (!state.queue.length) state.finished = true

  return { critique, nextQuestion: currentQuestion(state), finished: state.finished }
}

function applyScore(state: Session, q: Question, critique: Critique): void {
  const w = DIM_WEIGHTS[q.dim] || {}
  let delta =
    critique.completeness >= 80
      ? 6
      : critique.completeness >= 67
        ? 3
        : critique.criticalCount
          ? -4
          : -1
  if (critique.paramMissing.length) delta -= 2
  if (critique.issues.some((i) => i.title === '关键表述含糊')) delta -= 1
  if (critique.issues.some((i) => i.title === '绝对化表述')) delta -= 2
  if (q.isFollowUp && critique.completeness >= 60) delta += 1

  Object.keys(w).forEach((dim) => {
    const d = state.dims[dim]
    if (!d) return
    const step = Math.round(delta * w[dim])
    d.score = Math.max(30, Math.min(94, d.score + step))
    d.touched = true
    const note = critique.verdict + '（' + q.topic + '）'
    if (!d.notes.length || d.notes[d.notes.length - 1] !== note) d.notes.push(note)
    if (d.notes.length > 4) d.notes.shift()
  })
}

function appendRisks(state: Session, q: Question, critique: Critique): void {
  critique.issues.forEach((i) => {
    const key = i.name + '|' + i.title
    const found = state.risks.filter((r) => r.key === key)[0]
    if (found) {
      found.count += 1
      return
    }
    state.risks.push({
      key,
      kind: i.kind,
      name: i.name,
      cls: i.cls,
      sev: i.sev,
      title: i.title,
      detail: i.detail,
      why: i.why,
      asks: (i.asks || []).slice(),
      dim: q.dim,
      topic: q.topic,
      count: 1
    })
  })
}

/* ---------------- 报告 ---------------- */
const ADVICE_LIB: {
  tier: 'must' | 'should' | 'nice'
  when: (r: RiskItem) => boolean
  text: string
}[] = [
  {
    tier: 'must',
    when: (r) => r.kind === 'data',
    text: '把"能识别 / 效果不错"换成一页可复核的测试记录：条件分组 + 样本量 + 成功与失败次数。哪怕只有一组，也比口头结论强得多。'
  },
  {
    tier: 'must',
    when: (r) => r.kind === 'tech',
    text: '为每一处"可能出错"补一句失效保护：怎么判断这一帧不可信、不可信之后系统做什么。评审问到这里基本就是打分点。'
  },
  {
    tier: 'must',
    when: (r) => r.kind === 'logic',
    text: '把被绕开的隐含问题主动写进材料（例如"去掉视觉还成不成立"），先给结论再给理由，避免现场被追问停顿。'
  },
  {
    tier: 'must',
    when: (r) => r.kind === 'param',
    text: '补齐关键参数：分辨率 / 帧率、采集到输出的延迟、UART 波特率与帧长、标定用的参照量与精度。'
  },
  {
    tier: 'should',
    when: (r) => /光照|遮挡|颜色|干扰/.test(r.title),
    text: '准备一组"异常条件实拍图"（侧光 / 阴影 / 强反光 / 局部遮挡），并明确标出哪些是目前已解决、哪些还是已知问题。'
  },
  {
    tier: 'should',
    when: (r) => /标定|坐标|机位|映射|换算/.test(r.title),
    text: '把"图像坐标 → 物理位置"的标定过程画出来：参照物、采样点、换算关系、误差范围。'
  },
  {
    tier: 'should',
    when: (r) => /通信|丢包|帧|协议/.test(r.title),
    text: '补一份通信帧定义表与丢包处理规则，给主控侧的验收留下依据。'
  },
  {
    tier: 'should',
    when: (r) => r.kind === 'evidence',
    text: '所有结论后面加一个"依据"：条件、数量或观测时长。这是提升证据分最省力的做法。'
  },
  {
    tier: 'nice',
    when: () => true,
    text: '准备一张系统框图 + 一张数据流图，答辩开场 30 秒用它讲清"谁给谁数据"。'
  },
  {
    tier: 'nice',
    when: () => true,
    text: '准备一句话的差异化表述，用于回答"你和别人的区别是什么"。'
  },
  {
    tier: 'nice',
    when: (r) => r.dim === '实用价值' || r.dim === '商业化',
    text: '补一个具体延展场景（谁 + 什么场合 + 做什么），让实用价值维度有落脚点。'
  }
]

const VISION_ADVICE = [
  '图像坐标到物理位置：写出标定方法（参照物 / 采样点 / 换算关系 / 精度），这是视觉被控制回路信任的前提。',
  '失效边界：明确给出"识别退化到什么程度还可接受"，以及不可接受时系统输出什么。',
  '异常条件清单：光照、反光、阴影、遮挡、机位漂移分别怎么处理；处理不了的，主动说明是已知问题。',
  '延迟账：采集 + 推理 + 传输的分段估算，以及这个延迟相对控制周期是否可接受。',
  '画出一张"识别结果 → 中心坐标 → 主控 → 控制输出"的完整链路图。'
]

export function buildReport(state: Session): Report {
  const rounds = state.rounds
  const risks = state.risks.slice().sort((a, b) => {
    const order: Record<string, number> = { h: 0, m: 1, l: 2 }
    return order[a.sev] - order[b.sev] || b.count - a.count
  })

  const byKind: Record<string, number> = {}
  risks.forEach((r) => {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1
  })

  const advice: { must: string[]; should: string[]; nice: string[] } = {
    must: [],
    should: [],
    nice: []
  }
  ADVICE_LIB.forEach((a) => {
    const hit = risks.some((r) => a.when(r))
    if (hit && advice[a.tier].indexOf(a.text) < 0) advice[a.tier].push(a.text)
  })
  if (!advice.must.length)
    advice.must.push('目前的回答没有暴露高风险项；建议把已经讲清楚的结论补上依据，让答辩更稳。')

  const material: string[] = []
  rounds.forEach((rd) => {
    ;(rd.critique.suggestions || []).forEach((s) => {
      if (material.indexOf(s) < 0) material.push(s)
    })
  })

  const dims = REVIEW_DIMS.map((d) => {
    const o = state.dims[d]
    return { name: d, score: o.score, notes: o.notes.slice() }
  })
  const avg = Math.round(dims.reduce((a, b) => a + b.score, 0) / dims.length)

  const mockCount = rounds.filter((r) => r.isMock).length
  const critCount = risks.filter((r) => r.sev === 'h').length

  const conclusion = buildConclusion(critCount, risks.length, state)

  return {
    project: state.project,
    rounds,
    risks,
    byKind,
    counts: {
      rounds: rounds.length,
      mock: mockCount,
      manual: rounds.length - mockCount,
      questions: rounds.filter((r) => !r.q.isFollowUp).length,
      followUps: rounds.filter((r) => r.q.isFollowUp).length,
      risks: risks.length,
      critical: critCount
    },
    dims,
    avg,
    advice,
    material,
    visionAdvice: state.isVision ? VISION_ADVICE.slice() : [],
    conclusion,
    scene: ICAN_SCENE,
    disclaimer: DISCLAIMER
  }
}

function buildConclusion(crit: number, totalRisks: number, state: Session): string {
  const head =
    '本轮模拟质询共进行了 ' +
    state.rounds.length +
    ' 轮，识别出 ' +
    totalRisks +
    ' 个待处理点，其中高优先级 ' +
    crit +
    ' 个。'
  let body: string
  if (crit >= 3)
    body =
      '整体判断：项目的方向和结构是成立的，但"可验证性"这一环偏弱——目前多处结论还停留在观察描述，缺少测试记录、参数与失效处理。补上这些之后，这套方案会从"能演示"变成"能被验证"。'
  else if (crit >= 1)
    body =
      '整体判断：主体链路已经能讲清楚，剩下的主要是把关键环节的数字和边界补上。这些缺口都不需要推翻方案，属于答辩前可以补齐的工作量。'
  else
    body =
      '整体判断：几条主干问题都给出了有效回应，下一步可以把回答组织得更有结构（结论 → 依据 → 边界），这样现场追问会更从容。'
  if (state.isVision)
    body +=
      ' 视觉部分建议按"标定 → 失效边界 → 异常条件 → 延迟"的顺序整理，这四条是这类项目被追问最集中的地方。'
  body += ' 注意：以上为模拟评审结果，仅用于正式答辩前的自查，不代表任何比赛的官方评审结论。'
  return head + body
}

export function validateProject(p: Project | null): { ok: boolean; errors: string[] } {
  const errs: string[] = []
  if (!p || !norm(p.name).trim()) errs.push('请填写项目名称')
  if (!p || norm(p.brief).trim().length < 8) errs.push('请填写项目简介（至少 8 个字）')
  return { ok: errs.length === 0, errors: errs }
}

/* ---------------- 导出 API（与原版 AIJ_ENGINE 形状一致） ---------------- */
export const engineApi = {
  buildChain,
  createSession,
  currentQuestion,
  progress,
  analyze,
  submit,
  buildReport,
  validateProject,
  mockOf,
  isVisionProject,
  REVIEW_DIMS,
  DIM_WEIGHTS,
  DIM_META,
  RISK_KINDS,
  ICAN_SCENE,
  DISCLAIMER,
  SAMPLE_PROJECT
}
