/* ============================================================
   AI 安全与可控性
   - 输入内容过滤（本地关键词，答辩场景的安全底线）
   - 超长输入限制
   - 不虚构数据原则已在引擎/提示词中贯穿
   说明：规则引擎的锐评逐条给出「为什么是问题 / 评委怎么追问 /
   建议补什么」，本身就是可解释性设计。
   ============================================================ */

export interface InputCheck {
  ok: boolean
  reason?: string
}

/** 答辩/评审场景下的内容底线：命中即拦截 */
const BLOCKED_RULES: { re: RegExp; reason: string }[] = [
  { re: /杀\s*人|杀\s*死|炸\s*弹|恐怖|袭\s*击/, reason: '内容涉及暴力或违法表述，请勿在评审场景使用' },
  { re: /毒\s*品|贩\s*毒|吸\s*毒/, reason: '内容涉及违禁品，请勿在评审场景使用' },
  { re: /贿\s*赂|买\s*通|作\s*弊/, reason: '内容涉及不当行为，请勿在评审场景使用' },
  { re: /去死|滚蛋|傻\s*逼|他妈的|操你/, reason: '内容含攻击性语言，请文明表述' }
]

const MAX_LEN = 6000

export function checkInput(text: string): InputCheck {
  const t = (text || '').trim()
  if (t.length > MAX_LEN) {
    return { ok: false, reason: `回答过长（${t.length} 字），请精简到 ${MAX_LEN} 字以内` }
  }
  for (const rule of BLOCKED_RULES) {
    if (rule.re.test(t)) {
      return { ok: false, reason: rule.reason }
    }
  }
  return { ok: true }
}
