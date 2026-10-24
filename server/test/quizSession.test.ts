import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoQuestionService } from '../src/quizService.js';
import { InvalidQuizSessionError, QuizSessionCodec, QuizSessionConfigurationError } from '../src/quizSession.js';

test('quiz sessions survive independent codec instances and keep answer data encrypted', async () => {
  const quiz = await new DemoQuestionService().generate({ topic: 'Python', difficulty: 'easy', count: 5 });
  const secret = 'a sufficiently long test-only session secret';
  const token = new QuizSessionCodec(secret).seal(quiz);
  const restored = new QuizSessionCodec(secret).open(token);
  assert.equal(restored.quizId, quiz.quizId);
  assert.equal(restored.questions[0]?.answerIndex, quiz.questions[0]?.answerIndex);
  assert.equal(token.includes(quiz.questions[0]!.prompt), false);
});

test('quiz sessions reject altered tokens, expired tokens, and short secrets', async () => {
  const quiz = await new DemoQuestionService().generate({ topic: 'Python', difficulty: 'easy', count: 5 });
  const codec = new QuizSessionCodec('a sufficiently long test-only session secret');
  const token = codec.seal(quiz);
  const bytes = Buffer.from(token, 'base64url');
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => codec.open(bytes.toString('base64url')), InvalidQuizSessionError);
  assert.throws(() => new QuizSessionCodec('short').seal(quiz), QuizSessionConfigurationError);
  assert.throws(() => new QuizSessionCodec('a sufficiently long test-only session secret', 0).open(new QuizSessionCodec('a sufficiently long test-only session secret', 0).seal(quiz)), InvalidQuizSessionError);
});
