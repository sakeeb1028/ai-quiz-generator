import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { DemoQuestionService, InsufficientQuestionsError, UnsupportedTopicError, type QuestionGenerationService } from './quizService.js';
import { validateAndScore } from './quizLogic.js';
import { GeminiConfigurationError, GeminiOutputError, GeminiQuizService, GeminiTimeoutError, GoogleGenAITextGenerator } from './geminiQuizService.js';
import { InvalidQuizSessionError, QuizSessionCodec, QuizSessionConfigurationError } from './quizSession.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '128kb' }));
app.use((req, _res, next) => {
  const apiPath = req.query.__vercel_api_path;
  if (typeof apiPath === 'string' && apiPath.startsWith('/api/')) req.url = apiPath;
  next();
});
const mode = process.env.QUIZ_GENERATION_MODE === 'demo' ? 'demo' : 'gemini';
const service: QuestionGenerationService = mode === 'demo'
  ? new DemoQuestionService()
  : new GeminiQuizService(new GoogleGenAITextGenerator(process.env.GEMINI_API_KEY), process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite');
const localSessionSecret = process.env.VERCEL ? undefined : randomBytes(32).toString('base64url');
const sessions = new QuizSessionCodec(process.env.QUIZ_SESSION_SECRET ?? localSessionSecret);
const generationRequests = new Map<string, number[]>();
const rateLimit = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const now = Date.now();
  const key = req.ip ?? 'unknown';
  const recent = (generationRequests.get(key) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many quiz requests. Please wait a minute and try again.' });
  recent.push(now);
  generationRequests.set(key, recent);
  next();
};
const generateSchema = z.object({ topic: z.string().trim().min(2).max(80), difficulty: z.enum(['easy', 'medium', 'hard']), count: z.union([z.literal(5), z.literal(10), z.literal(15)]) });
const submissionSchema = z.object({ sessionToken: z.string().min(1).max(100_000), answers: z.array(z.object({ questionId: z.string().uuid(), selectedIndex: z.number().int().min(0).max(3) })).max(15) });

app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: mode === 'demo' ? 'demo-question-bank' : 'gemini', model: mode === 'gemini' ? process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite' : undefined }));
app.get('/api/topics', (_req, res) => res.json({ topics: [{ name: 'Python', difficulties: ['easy', 'medium', 'hard'] }, { name: 'Machine Learning', difficulties: ['easy', 'medium', 'hard'] }, { name: 'Generative AI', difficulties: ['easy', 'medium', 'hard'] }] }));
app.post('/api/quizzes', rateLimit, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid quiz request.' });
  try {
    const quiz = await service.generate(parsed.data);
    const sessionToken = sessions.seal(quiz);
    return res.status(201).json({ quizId: quiz.quizId, sessionToken, topic: quiz.topic, difficulty: quiz.difficulty, questions: quiz.questions.map(({ answerIndex: _answerIndex, explanation: _explanation, ...q }) => q) });
  } catch (error) {
    if (error instanceof UnsupportedTopicError) return res.status(404).json({ error: error.message });
    if (error instanceof InsufficientQuestionsError) return res.status(422).json({ error: error.message });
    if (error instanceof GeminiConfigurationError) return res.status(503).json({ error: 'AI quiz generation is not configured. Set GEMINI_API_KEY in the server environment.' });
    if (error instanceof QuizSessionConfigurationError) return res.status(503).json({ error: 'Quiz session security is not configured on the server.' });
    if (error instanceof GeminiTimeoutError) return res.status(504).json({ error: 'Quiz generation timed out. Please try again.' });
    if (error instanceof GeminiOutputError) return res.status(502).json({ error: 'AI returned an invalid quiz. Please try again.' });
    return res.status(500).json({ error: 'Could not create the quiz. Please try again.' });
  }
});
app.post('/api/quizzes/:id/submit', (req, res) => {
  const parsed = submissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid answer submission.' });
  try {
    const quiz = sessions.open(parsed.data.sessionToken);
    if (quiz.quizId !== req.params.id) return res.status(400).json({ error: 'Quiz session does not match this quiz.' });
    return res.json(validateAndScore(quiz.questions, parsed.data.answers));
  } catch (error) {
    if (error instanceof InvalidQuizSessionError) return res.status(404).json({ error: error.message });
    if (error instanceof QuizSessionConfigurationError) return res.status(503).json({ error: 'Quiz session security is not configured on the server.' });
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid answers.' });
  }
});

export default app;
