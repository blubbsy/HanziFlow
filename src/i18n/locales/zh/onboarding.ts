import type { onboarding as en } from '../en/onboarding';

export const onboarding: Record<keyof typeof en, string> = {
  'onboarding.stepOf': '第 {n} 步，共 {total} 步',
  'onboarding.skip': '暂时跳过',
  'onboarding.back': '返回',
  'onboarding.next': '继续',
  'onboarding.start': '开始第一次学习',
  'onboarding.startNote': '第一次学习只有 {count} 个词。以后可以在设置中修改这些选项。',
  'onboarding.language.title': '你想学什么？',
  'onboarding.language.desc': '之后可以随时添加更多课程，每门课程的进度互相独立。',
  'onboarding.level.title': '你现在的基础如何？',
  'onboarding.level.beginner': '完全零基础',
  'onboarding.level.beginnerDesc': '从最基础的词开始。',
  'onboarding.level.some': '我会一些',
  'onboarding.level.someDesc': '做一个简短的测试，确定水平并跳过已掌握的内容。',
  'onboarding.goal.title': '每天想学多久？',
  'onboarding.goal.light': '轻松',
  'onboarding.goal.regular': '常规',
  'onboarding.goal.intense': '强化',
  'onboarding.goal.desc': '每天约 {min} 分钟 · 每次 {count} 张卡片',
};
