<script setup lang="ts">
import { computed } from 'vue'
import type { Question } from '@/types/engine'

const props = defineProps<{
  question: Question
  no: number
}>()

const isFollowUp = computed(() => !!props.question.isFollowUp)

function qcode(i: number): string {
  return 'Q_' + (i < 10 ? '0' + i : i)
}
</script>

<template>
  <div class="qcard fade-in">
    <div class="qhead">
      <span class="k-label">CURRENT QUESTION · 当前问题</span>
      <span class="qcode">{{ qcode(no) }}</span>
      <span class="tag blue">{{ question.dim }}</span>
      <span v-if="isFollowUp" class="tag orange">追问 · 针对上一轮的缺口</span>
      <span v-else class="tag">{{ question.topic }}</span>
    </div>
    <p class="qtext">{{ question.text }}</p>
    <div class="qmeta">
      <div class="box">
        <div class="k">评委为什么问这个</div>
        <div class="v">{{ question.focus || '' }}</div>
      </div>
      <div class="box">
        <div class="k">完整回答应包含</div>
        <ul>
          <li
            v-for="(e, i) in question.evidence && question.evidence.length
              ? question.evidence
              : ['给出一个具体做法，并说明它的边界']"
            :key="i"
          >
            {{ e }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
