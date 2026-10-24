import type { Question } from './quizService.js';

export function validateAndScore(questions: Question[], answers: unknown) {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error('Submit one answer for every question.');
  const normalized = answers.map((a) => {
    if (!a || typeof a !== 'object' || typeof (a as { questionId?: unknown }).questionId !== 'string' || !Number.isInteger((a as { selectedIndex?: unknown }).selectedIndex)) throw new Error('Each answer must include a question ID and option number.');
    return a as { questionId: string; selectedIndex: number };
  });
  const ids = normalized.map((a) => a.questionId);
  if (new Set(ids).size !== ids.length || questions.some((q) => !ids.includes(q.id)) || normalized.some((a) => !questions.some((q) => q.id === a.questionId))) throw new Error('Answers must match this quiz exactly.');
  const details = questions.map((q) => {
    const answer = normalized.find((a) => a.questionId === q.id)!;
    if (answer.selectedIndex < 0 || answer.selectedIndex >= q.options.length) throw new Error('Selected option is out of range.');
    return { questionId: q.id, prompt: q.prompt, options: q.options, selectedIndex: answer.selectedIndex, correctIndex: q.answerIndex, isCorrect: answer.selectedIndex === q.answerIndex, explanation: q.explanation };
  });
  const score = details.filter((a) => a.isCorrect).length;
  return { score, total: questions.length, percentage: Math.round((score / questions.length) * 100), answers: details };
}
