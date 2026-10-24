import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { QuestionGenerationService } from './quizService.js';

type QuizState = Awaited<ReturnType<QuestionGenerationService['generate']>>;
type SessionPayload = { expiresAt: number; quiz: QuizState };

export class QuizSessionConfigurationError extends Error {}
export class InvalidQuizSessionError extends Error {}

export class QuizSessionCodec {
  private readonly key: Buffer | undefined;

  constructor(secret: string | undefined, private readonly lifetimeMs = 60 * 60 * 1000) {
    if (secret && secret.length >= 32) this.key = createHash('sha256').update(secret).digest();
  }

  seal(quiz: QuizState) {
    if (!this.key) throw new QuizSessionConfigurationError('QUIZ_SESSION_SECRET must be set to at least 32 characters.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const payload: SessionPayload = { expiresAt: Date.now() + this.lifetimeMs, quiz };
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return Buffer.from(JSON.stringify({ iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), data: ciphertext.toString('base64url') })).toString('base64url');
  }

  open(token: string): QuizState {
    if (!this.key) throw new QuizSessionConfigurationError('QUIZ_SESSION_SECRET is not configured.');
    try {
      const envelope = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { iv: string; tag: string; data: string };
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64url')), decipher.final()]).toString('utf8');
      const payload = JSON.parse(plaintext) as SessionPayload;
      if (!payload || typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now() || !payload.quiz?.quizId || !Array.isArray(payload.quiz.questions)) throw new Error('Invalid session payload');
      return payload.quiz;
    } catch {
      throw new InvalidQuizSessionError('Quiz session is invalid or expired. Generate another quiz to continue.');
    }
  }
}
