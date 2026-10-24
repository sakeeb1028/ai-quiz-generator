import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Brain, Check, ChevronRight, CircleHelp, Clock3, Flame, Layers3, Lightbulb, LoaderCircle, RefreshCw, Sparkles, Target, Trophy, X } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';
type Question = { id: string; prompt: string; options: string[] };
type Quiz = { quizId: string; sessionToken: string; topic: string; difficulty: Difficulty; questions: Question[] };
type Result = { score: number; total: number; percentage: number; answers: { questionId: string; prompt: string; options: string[]; selectedIndex: number; correctIndex: number; isCorrect: boolean; explanation: string }[] };
const popular = ['Python', 'Machine Learning', 'Generative AI'];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
  return data as T;
}

function App() {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [count, setCount] = useState<5 | 10 | 15>(5);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const active = quiz?.questions[current];
  const answeredCount = answers.filter((a) => a >= 0).length;
  const progress = quiz ? (result ? 100 : (current / quiz.questions.length) * 100) : 0;
  const greeting = useMemo(() => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), []);

  async function generate() {
    setLoading(true); setError('');
    try {
      const created = await api<Quiz>('/api/quizzes', { method: 'POST', body: JSON.stringify({ topic, difficulty, count }) });
      setQuiz(created); setAnswers(Array(created.questions.length).fill(-1)); setCurrent(0); setResult(null); setTopic(created.topic);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create your quiz.'); }
    finally { setLoading(false); }
  }
  function goHome() { setQuiz(null); setResult(null); setAnswers([]); setCurrent(0); setError(''); }
  async function submit() {
    if (!quiz || answers.some(a => a < 0)) return;
    setLoading(true); setError('');
    try { setResult(await api<Result>(`/api/quizzes/${quiz.quizId}/submit`, { method: 'POST', body: JSON.stringify({ sessionToken: quiz.sessionToken, answers: quiz.questions.map((q, i) => ({ questionId: q.id, selectedIndex: answers[i] })) }) })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not submit your answers.'); }
    finally { setLoading(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={goHome} aria-label="Quizly home"><span className="brand-mark"><Sparkles size={18} fill="currentColor" /></span><span>quizly<span className="brand-dot">.</span></span></button><div className="top-right"><span className="date-label">{greeting}</span><span className="avatar">S</span></div></header>
    <main className="main-content">
      {!quiz ? <>
        <section className="hero"><div className="eyebrow"><span className="eyebrow-dot"/> YOUR PERSONAL STUDY SPACE</div><h1>Make learning<br/><span>stick.</span></h1><p>Turn any topic into a little moment of progress.<br className="desktop-break"/> Pick a subject, find your focus, and see what you know.</p></section>
        <section className="dashboard-grid">
          <div className="panel builder-panel"><div className="panel-heading"><div><div className="step-label">01 <span>·</span> SET YOUR INTENTION</div><h2>What are we learning today?</h2></div><div className="heading-icon"><Brain size={20}/></div></div>
            <label className="field-label" htmlFor="topic">YOUR TOPIC</label><div className="input-wrap"><BookOpen size={18}/><input id="topic" value={topic} onChange={e=>setTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&generate()} placeholder="Try Python, machine learning…" maxLength={80}/><span className="input-hint">↵</span></div>
            <div className="popular-row"><span>POPULAR</span>{popular.map(item=><button key={item} onClick={()=>setTopic(item)} className={`topic-chip ${topic.toLowerCase()===item.toLowerCase()?'selected':''}`}>{item}</button>)}</div>
            <div className="setting-row"><div className="setting-title"><span className="field-label">DIFFICULTY</span><span className="field-sub">Find your level</span></div><div className="segmented">{(['easy','medium','hard'] as Difficulty[]).map((level)=><button key={level} className={difficulty===level?'active':''} onClick={()=>setDifficulty(level)}><span className={`level-dot level-${level}`}/>{level[0]!.toUpperCase()+level.slice(1)}</button>)}</div></div>
            <div className="setting-row count-row"><div className="setting-title"><span className="field-label">QUESTION COUNT</span><span className="field-sub">Set your pace</span></div><div className="count-select">{([5,10,15] as const).map((n)=><button key={n} className={count===n?'active':''} onClick={()=>setCount(n)}>{n}</button>)}</div></div>
            {error&&<div className="error-message"><X size={16}/>{error}</div>}
            <button className="primary-button generate-button" onClick={generate} disabled={loading||topic.trim().length<2}>{loading?<><LoaderCircle className="spin" size={18}/> Building your quiz…</>:<>Create my quiz <ArrowRight size={18}/></>}</button>
            <div className="demo-note"><Lightbulb size={15}/><span>Questions are tailored to your topic and selected level</span></div>
          </div>
          <aside className="side-column"><div className="panel note-card"><div className="note-icon"><Lightbulb size={20}/></div><div className="note-kicker">A LITTLE REMINDER</div><h3>Progress over<br/>perfection.</h3><p>Every question you try is a step forward. Stay curious and enjoy the process.</p><div className="note-decoration">✳</div></div>
            <div className="panel topics-card"><div className="topics-card-head"><div><span className="step-label">YOUR STARTING POINT</span><h3>Explore a topic</h3></div><Layers3 size={17}/></div>{popular.map((t,i)=><button key={t} className="topic-row" onClick={()=>setTopic(t)}><span className={`topic-icon topic-icon-${i}`}><Target size={16}/></span><span>{t}</span><ChevronRight size={16}/></button>)}</div></aside>
        </section><footer className="footer"><span>Made for curious minds.</span><span><CircleHelp size={14}/> Take your time. You’ve got this.</span></footer>
      </> : result ? <>
        <button className="back-link" onClick={goHome}><ArrowLeft size={16}/> BACK TO YOUR STUDY SPACE</button>
        <section className="result-hero"><div className="result-icon"><Trophy size={26}/></div><div className="eyebrow">QUIZ COMPLETE <span className="eyebrow-dot"/></div><h1>{result.percentage>=80?'Beautiful work.':result.percentage>=50?'Look at you, learning.':'A good place to start.'}</h1><p>You showed up for <strong>{quiz.topic}</strong>. That’s what counts.</p></section>
        <section className="result-layout"><div className="panel score-card"><div className="score-ring" style={{'--score':`${result.percentage*3.6}deg`} as React.CSSProperties}><div><strong>{result.percentage}<small>%</small></strong><span>YOUR SCORE</span></div></div><div className="score-detail"><div><strong>{result.score}<span> / {result.total}</span></strong><small>Correct answers</small></div><div><strong>{result.total-result.score}</strong><small>Room to grow</small></div></div><div className="score-divider"/><div className="result-meta"><span><BookOpen size={15}/>{quiz.topic}</span><span><Flame size={15}/>{difficulty}</span></div><button className="primary-button" onClick={goHome}><RefreshCw size={16}/> Try another topic</button></div>
          <div className="review-column"><div className="review-heading"><div><span className="step-label">TAKE A CLOSER LOOK</span><h2>Your answers</h2></div><span className="review-count">{result.total} QUESTIONS</span></div>{result.answers.map((a,i)=><article key={a.questionId} className={`panel review-card ${a.isCorrect?'correct':'incorrect'}`}><div className="review-q"><span className={`review-status ${a.isCorrect?'':'wrong'}`}>{a.isCorrect?<Check size={15}/>:<X size={15}/>}</span><div><span className="review-number">QUESTION {String(i+1).padStart(2,'0')}</span><h3>{a.prompt}</h3></div></div><div className="review-answers">{a.options.map((option,j)=><div key={j} className={`review-option ${j===a.correctIndex?'right-answer':''} ${j===a.selectedIndex&&!a.isCorrect?'your-wrong':''}`}><span className="option-letter">{String.fromCharCode(65+j)}</span><span>{option}</span>{j===a.correctIndex&&<Check size={14}/>}</div>)}</div><div className="explanation"><Lightbulb size={15}/><span>{a.explanation}</span></div></article>)}</div></section>
      </> : <>
        <button className="back-link" onClick={goHome}><ArrowLeft size={16}/> LEAVE QUIZ</button><section className="quiz-top"><div className="quiz-title-wrap"><span className="eyebrow"><span className="eyebrow-dot"/> FOCUS TIME</span><h1>{quiz.topic}<span className="title-light">, at your pace.</span></h1><div className="quiz-meta"><span><Flame size={15}/>{quiz.difficulty} level</span><span><Clock3 size={15}/>{quiz.questions.length} questions</span></div></div><div className="quiz-score-chip"><Target size={17}/><span>{answeredCount}<small> / {quiz.questions.length} answered</small></span></div></section>
        <div className="progress-section"><div className="progress-labels"><span>YOUR PROGRESS</span><span>{current+1} <span className="muted">/ {quiz.questions.length}</span></span></div><div className="progress-track"><div className="progress-fill" style={{width:`${progress}%`}}/></div></div>
        <section className="quiz-layout"><div className="panel question-card"><div className="question-topline"><span>QUESTION {String(current+1).padStart(2,'0')}</span><span className="question-mark"><CircleHelp size={16}/></span></div><h2>{active?.prompt}</h2><span className="field-label answer-hint">CHOOSE ONE ANSWER</span><div className="answer-list">{active?.options.map((option,i)=><button key={option} onClick={()=>setAnswers(a=>a.map((v,j)=>j===current?i:v))} className={`answer-option ${answers[current]===i?'chosen':''}`}><span className="answer-letter">{String.fromCharCode(65+i)}</span><span>{option}</span><span className="answer-check">{answers[current]===i&&<Check size={15}/>}</span></button>)}</div><div className="question-controls"><button className="text-button" onClick={()=>setCurrent(c=>Math.max(0,c-1))} disabled={current===0}><ArrowLeft size={16}/> Previous</button>{current<quiz.questions.length-1?<button className="primary-button next-button" onClick={()=>setCurrent(c=>c+1)} disabled={answers[current]<0}>Next question <ArrowRight size={16}/></button>:<button className="primary-button next-button" onClick={submit} disabled={answeredCount!==quiz.questions.length||loading}>{loading?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>} Finish quiz</button>}</div>{error&&<div className="error-message"><X size={16}/>{error}</div>}</div>
          <aside className="quiz-aside"><div className="panel encouragement"><div className="encourage-icon"><Sparkles size={17}/></div><span className="step-label">YOU’RE DOING GREAT</span><h3>One question<br/>at a time.</h3><p>There’s no rush. Think it through and trust what you know.</p></div><div className="panel question-nav"><span className="step-label">JUMP TO A QUESTION</span><div className="question-dots">{quiz.questions.map((_,i)=><button aria-label={`Question ${i+1}`} className={`${i===current?'current':''} ${answers[i]>=0?'answered':''}`} onClick={()=>setCurrent(i)} key={i}>{String(i+1).padStart(2,'0')}</button>)}</div><div className="legend"><span><i className="legend-current"/>Current</span><span><i className="legend-answered"/>Answered</span></div></div></aside></section>
      </>}
    </main>
  </div>;
}
export default App;
