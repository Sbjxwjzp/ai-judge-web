/* ============================================================
   AI刁钻评委 — 类型定义
   质询引擎与数据层共享的 TypeScript 接口
   ============================================================ */

/** 项目资料（示例项目或用户自定义项目） */
export interface Project {
  id: string
  kind?: string
  type?: string
  name: string
  role?: string
  brief: string
  background?: string
  tech?: string
  progress?: string
  data?: string
  tags?: string[]
  scene?: string
  updated?: string
}

/** 识别词表：label 是证据/参数的名称，words 是触发词 */
export interface WordSet {
  label: string
  words: string[]
}

/** 必须正面回答的隐含问题 */
export interface MustCover {
  ask: string
  words: string[]
}

/** 题目自定义规则产出的问题条目 */
export interface ExtraIssue {
  kind: string
  sev?: string
  title: string
  detail: string
  why?: string
  asks?: string[]
}

/** 质询题（主线题 / 视觉增强题 / 追问） */
export interface Question {
  id: string
  dim: string
  topic: string
  text: string
  focus: string
  evidence: string[]
  keys: WordSet[]
  params: WordSet[]
  mustCover?: MustCover
  suggest?: string[]
  deepQ?: string
  gapQ?: string
  mock?: string | ((project: Project | Record<string, never>) => string)
  extra?: (ans: string, state: Session) => ExtraIssue[]
  /* 追问题专有字段 */
  isFollowUp?: boolean
  parentId?: string
  followType?: string
}

/** 风险类型元信息 */
export interface RiskKindMeta {
  name: string
  cls: string
  sev: string
}

/** 分析词典（含糊 / 绝对化 / 效果 / 失效处理 / 量化 / 标准） */
export interface Lexicon {
  vague: string[]
  absolute: string[]
  effect: string[]
  mitigation: string[]
  quantify: string[]
  standard: string[]
}

/** 评审维度元信息 */
export interface DimMeta {
  desc: string
  keys: string[]
}

/** 单个维度的会话内状态 */
export interface DimState {
  score: number
  notes: string[]
  touched: boolean
}

/** 单条已识别问题（锐评条目） */
export interface Issue {
  kind: string
  name: string
  cls: string
  sev: string
  title: string
  detail: string
  why: string
  asks: string[]
  bespoke: boolean
}

/** 风险累计条目 */
export interface RiskItem {
  key: string
  kind: string
  name: string
  cls: string
  sev: string
  title: string
  detail: string
  why: string
  asks: string[]
  dim: string
  topic: string
  count: number
}

/** 一轮回答的分析结果 */
export interface Critique {
  qid: string
  isFollowUp: boolean
  completeness: number
  matched: string[]
  missing: string[]
  paramMissing: string[]
  issues: Issue[]
  verdict: string
  criticalCount: number
  midCount: number
  summary: string
  suggestions: string[]
  nextAsks: string[]
  nextType: string | null
  nextText: string
}

/** 一轮质询记录 */
export interface Round {
  no: number
  q: Question
  answer: string
  isMock: boolean
  critique: Critique
  at: number
}

/** 质询会话状态（createSession 产出） */
export interface Session {
  project: Project | null
  chain: Question[]
  queue: Question[]
  stage: number
  totalStages: number
  followUpsThisStage: number
  rounds: Round[]
  risks: RiskItem[]
  dims: Record<string, DimState>
  finished: boolean
  startedAt: number
  isVision: boolean
}

/** submit 的返回 */
export interface SubmitResult {
  critique?: Critique
  nextQuestion?: Question | null
  finished?: boolean
  error?: string
}

/** 进度信息 */
export interface ProgressInfo {
  done: number
  total: number
  round: number
}

/** 报告结论 */
export interface Report {
  project: Project | null
  rounds: Round[]
  risks: RiskItem[]
  byKind: Record<string, number>
  counts: {
    rounds: number
    mock: number
    manual: number
    questions: number
    followUps: number
    risks: number
    critical: number
  }
  dims: { name: string; score: number; notes: string[] }[]
  avg: number
  advice: { must: string[]; should: string[]; nice: string[] }
  material: string[]
  visionAdvice: string[]
  conclusion: string
  scene: string
  disclaimer: string
}
