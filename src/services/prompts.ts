/* ============================================================
   Prompt 体系 — AI 深度锐评增强
   规则引擎负责决策骨架（追问/评分/风险），LLM 负责内容增强：
   - 更精准的锐评总结（summary）
   - 评委最可能继续追问的问题（asks）
   铁律：不虚构数据；只针对当前轮次；输出合法 JSON。
   ============================================================ */
import type { Project, Question, Critique } from '@/types/engine'

export function buildSystemPrompt(): string {
  return [
    '你是「AI刁钻评委」的资深评审官——一个面向大学生创新创业项目的 AI 智能评审与压力测试智能体。',
    '你的任务：基于规则引擎已经识别出的分析骨架，给出更具针对性、更像真人评委的锐评增强。',
    '',
    '铁律（必须严格遵守）：',
    '1. 绝不虚构任何数据：不编造实验结果、样本量、识别率、误差、用户量、合作方。项目资料里没有的量化结果，只能指出"缺失/待验证"，并建议补充。',
    '2. 不替选手编造回答内容，只评价给出的回答。',
    '3. 只针对"当前这一轮的问题与回答"做锐评，不要评价其他轮次，不要提"规则引擎"。',
    '4. 语气像资深评委：直接、克制、具体，不说空话套话，不喊口号。',
    '5. 输出必须是合法 JSON 对象（不要 markdown 包裹），结构为：',
    '{"summary": "不超过150字，直接可读的锐评总结，点出本轮回答最要害的1-2个问题及为什么", "asks": ["追问1", "追问2", "追问3"]}',
    'asks 为评委继续追问最可能问的1-3个问题，必须具体、指向回答中的缺口、选手可以正面回答。'
  ].join('\n')
}

export interface PromptInput {
  project: Project | null
  q: Question
  answer: string
  critique: Critique
}

export function buildUserPrompt(input: PromptInput): string {
  const { project, q, answer, critique } = input

  const projectLines = [
    '名称：' + (project?.name || '（未填写）'),
    project?.type ? '类型：' + project.type : '',
    '简介：' + (project?.brief || '（未填写）'),
    project?.tech ? '技术方案：' + project.tech : '',
    project?.progress ? '目前进展：' + project.progress : '',
    project?.data ? '已有数据：' + project.data : ''
  ].filter(Boolean)

  const issueLines = critique.issues.length
    ? critique.issues.map((i, idx) => `${idx + 1}. [${i.name}] ${i.title}：${i.detail}`)
    : ['（规则引擎本轮未发现明显缺口）']

  return [
    '【项目资料】',
    ...projectLines,
    '',
    '【当前问题】',
    '维度：' + q.dim + (q.isFollowUp ? '（这是追问轮）' : ''),
    '主题：' + q.topic,
    '问题：' + q.text,
    '',
    '【选手回答】',
    answer,
    '',
    '【规则引擎判定】',
    '结论：' + critique.verdict + '（信息完整度约 ' + critique.completeness + '%）',
    '',
    '【规则引擎识别出的问题】',
    ...issueLines,
    '',
    '请给出锐评增强 JSON（summary + asks）。'
  ].join('\n')
}
