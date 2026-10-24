import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiConfigurationError, GeminiOutputError, GeminiQuizService, GeminiTimeoutError, GoogleGenAITextGenerator, type GeminiTextGenerator } from '../src/geminiQuizService.js';

const validQuestion = (n: number) => ({ prompt: `Question number ${n} about the topic?`, options: ['Answer A', 'Answer B', 'Answer C', 'Answer D'], correctAnswerIndex: 2, explanation: 'Answer C is correct because the concept supports it.' });
class MockGenerator implements GeminiTextGenerator {
  lastInput: Parameters<GeminiTextGenerator['generateContent']>[0] | undefined;
  constructor(private readonly output: string | undefined) {}
  async generateContent(input: Parameters<GeminiTextGenerator['generateContent']>[0]) { this.lastInput = input; return this.output; }
}

test('requests structured Gemini output with selected quiz parameters and maps trusted answer keys', async () => {
  const generator = new MockGenerator(JSON.stringify({ questions: [validQuestion(1), validQuestion(2)] }));
  const service = new GeminiQuizService(generator, 'test-model');
  const quiz = await service.generate({ topic: 'Biology', difficulty: 'hard', count: 2 });
  assert.equal(generator.lastInput?.model, 'test-model');
  assert.match(generator.lastInput?.prompt ?? '', /Topic: Biology/);
  assert.match(generator.lastInput?.prompt ?? '', /Difficulty: hard/);
  assert.match(generator.lastInput?.prompt ?? '', /Question count: 2/);
  assert.equal((generator.lastInput?.responseSchema.properties as { questions: unknown }).questions !== undefined, true);
  assert.equal(quiz.questions.length, 2);
  assert.equal(quiz.questions[0]?.answerIndex, 2);
  assert.equal(quiz.questions[0]?.options.length, 4);
});

test('rejects incomplete, malformed, duplicate-option, and wrong-count Gemini output', async () => {
  for (const output of [
    'not json',
    JSON.stringify({ questions: [{ ...validQuestion(1), options: ['only', 'three', 'choices'] }] }),
    JSON.stringify({ questions: [{ ...validQuestion(1), correctAnswerIndex: 4 }] }),
    JSON.stringify({ questions: [{ ...validQuestion(1), explanation: '' }] }),
    JSON.stringify({ questions: [{ ...validQuestion(1), options: ['same', 'same', 'C', 'D'] }] }),
    JSON.stringify({ questions: [validQuestion(1)] }),
  ]) {
    const service = new GeminiQuizService(new MockGenerator(output));
    await assert.rejects(() => service.generate({ topic: 'Biology', difficulty: 'easy', count: 2 }), GeminiOutputError);
  }
});

test('preserves timeout errors for the API layer to map to a safe timeout response', async () => {
  const generator: GeminiTextGenerator = { generateContent: async () => { throw new GeminiTimeoutError(); } };
  await assert.rejects(() => new GeminiQuizService(generator).generate({ topic: 'Biology', difficulty: 'easy', count: 5 }), GeminiTimeoutError);
});

test('fails closed when the server API key is missing', async () => {
  await assert.rejects(() => new GoogleGenAITextGenerator(undefined).generateContent({ model: 'test-model', prompt: 'test', responseSchema: {} }), GeminiConfigurationError);
});
