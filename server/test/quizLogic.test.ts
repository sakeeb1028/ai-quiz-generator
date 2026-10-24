import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndScore } from '../src/quizLogic.js';
import { DemoQuestionService, UnsupportedTopicError, InsufficientQuestionsError } from '../src/quizService.js';

test('scores answers using the server question bank', async () => {
  const quiz = await new DemoQuestionService().generate({ topic: 'python', difficulty: 'easy', count: 5 });
  const result = validateAndScore(quiz.questions, quiz.questions.map((q, i) => ({ questionId: q.id, selectedIndex: i === 0 ? q.answerIndex : (q.answerIndex + 1) % 4 })));
  assert.equal(result.score, 1);
  assert.equal(result.total, 5);
  assert.equal(result.percentage, 20);
});
test('rejects missing, duplicate, mismatched, and out-of-range answers', async () => {
  const quiz = await new DemoQuestionService().generate({ topic: 'python', difficulty: 'easy', count: 5 });
  assert.throws(() => validateAndScore(quiz.questions, []), /every question/);
  const one = { questionId: quiz.questions[0]!.id, selectedIndex: 0 };
  assert.throws(() => validateAndScore(quiz.questions, [one, one, ...quiz.questions.slice(2).map(q => ({ questionId: q.id, selectedIndex: 0 }))]), /exactly/);
  assert.throws(() => validateAndScore(quiz.questions, quiz.questions.map(q => ({ questionId: q.id, selectedIndex: 4 }))), /out of range/);
});
test('rejects unsupported topics and unavailable count/difficulty combinations', async () => {
  const service = new DemoQuestionService();
  await assert.rejects(() => service.generate({ topic: 'biology', difficulty: 'easy', count: 5 }), UnsupportedTopicError);
  await assert.rejects(() => service.generate({ topic: 'Python', difficulty: 'easy', count: 16 }), InsufficientQuestionsError);
});

test('every supported topic and difficulty can supply all advertised quiz sizes', async () => {
  const service = new DemoQuestionService();
  for (const topic of ['Python', 'Machine Learning', 'Generative AI']) {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const count of [5, 10, 15] as const) {
        const quiz = await service.generate({ topic, difficulty, count });
        assert.equal(quiz.questions.length, count, `${topic} ${difficulty} should return ${count}`);
        assert.ok(quiz.questions.every(q => q.options.length === 4));
      }
    }
  }
});

test('score and explanations come from server questions, ignoring forged client fields', async () => {
  const quiz = await new DemoQuestionService().generate({ topic: 'python', difficulty: 'easy', count: 5 });
  const forgedAnswers = quiz.questions.map(q => ({ questionId: q.id, selectedIndex: q.answerIndex, answerIndex: 99, isCorrect: false, explanation: 'forged' }));
  const result = validateAndScore(quiz.questions, forgedAnswers);
  assert.equal(result.score, 5);
  assert.ok(result.answers.every((answer, i) => answer.correctIndex === quiz.questions[i]!.answerIndex));
  assert.ok(result.answers.every(answer => answer.explanation !== 'forged'));
});
