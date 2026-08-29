import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  ArrowLeft,
  Award,
  Beaker,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Eye,
  Filter,
  History,
  LockKeyhole,
  Play,
  Send,
  Sparkles,
  Target,
  X
} from "lucide-react";

import AccessibleSelect from "./AccessibleSelect";
import { LANGUAGE_OPTIONS, getLanguageOption } from "../data/demo-executions";
import {
  createPracticeDraft,
  formatPracticeVerdict,
  practiceApi
} from "../utils/practice-api";
import { formatPlatformDate } from "../utils/user-platform-api";

const ALL_OPTION = { value: "", label: "All", description: "Show every problem" };
const DIFFICULTY_OPTIONS = [
  ALL_OPTION,
  { value: "easy", label: "Easy", color: "#66e2b3" },
  { value: "medium", label: "Medium", color: "#f6c177" },
  { value: "hard", label: "Hard", color: "#f27d8a" }
];

function languageOptions(languages = []) {
  return LANGUAGE_OPTIONS
    .filter((item) => languages.includes(item.id))
    .map((item) => ({
      value: item.id,
      label: item.label,
      description: item.filename,
      color: item.color
    }));
}

export default function PracticePlatformDialog({
  open,
  user,
  onClose,
  onOpenAccount,
  onVisualize
}) {
  const [problems, setProblems] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [problem, setProblem] = useState(null);
  const [difficulty, setDifficulty] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [solutionLanguage, setSolutionLanguage] = useState("javascript");
  const [source, setSource] = useState("");
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const supportedLanguageOptions = useMemo(
    () => languageOptions(problem?.languages),
    [problem?.languages]
  );
  const filterLanguageOptions = [
    ALL_OPTION,
    ...LANGUAGE_OPTIONS.map((item) => ({
      value: item.id,
      label: item.label,
      color: item.color
    }))
  ];

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setBusy("catalog");
    setError("");
    practiceApi.problems({ difficulty, language: languageFilter })
      .then((items) => {
        if (!active) return;
        setProblems(items);
        setSelectedSlug((current) => items.some((item) => item.slug === current)
          ? current
          : items[0]?.slug || "");
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setBusy(""));
    return () => { active = false; };
  }, [difficulty, languageFilter, open]);

  useEffect(() => {
    if (!open || !selectedSlug) {
      if (!selectedSlug) setProblem(null);
      return undefined;
    }
    let active = true;
    setBusy("problem");
    setResult(null);
    practiceApi.problem(selectedSlug)
      .then((nextProblem) => {
        if (!active) return;
        const draft = createPracticeDraft(nextProblem);
        setProblem(nextProblem);
        setSolutionLanguage(draft.language);
        setSource(draft.source);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setBusy(""));
    return () => { active = false; };
  }, [open, selectedSlug]);

  useEffect(() => {
    if (!open || !user) {
      setProgress(null);
      setSubmissions([]);
      return undefined;
    }
    let active = true;
    Promise.all([practiceApi.progress(), practiceApi.submissions()])
      .then(([nextProgress, nextSubmissions]) => {
        if (!active) return;
        setProgress(nextProgress);
        setSubmissions(nextSubmissions);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [open, user]);

  function changeSolutionLanguage(language) {
    const draft = createPracticeDraft(problem, language);
    setSolutionLanguage(draft.language);
    setSource(draft.source);
    setResult(null);
  }

  async function evaluate(mode) {
    if (!problem || !source.trim()) return;
    if (mode === "submit" && !user) {
      setError("Sign in to submit solutions and save your progress.");
      return;
    }
    setBusy(mode);
    setError("");
    try {
      const nextResult = mode === "submit"
        ? await practiceApi.submit(problem.slug, { language: solutionLanguage, source })
        : await practiceApi.run(problem.slug, { language: solutionLanguage, source });
      setResult(nextResult);
      if (mode === "submit") {
        const [nextProgress, nextSubmissions] = await Promise.all([
          practiceApi.progress(),
          practiceApi.submissions()
        ]);
        setProgress(nextProgress);
        setSubmissions(nextSubmissions);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  }

  if (!open) return null;

  return (
    <div className="practice-overlay" role="dialog" aria-modal="true" aria-labelledby="practice-title">
      <section className="practice-dialog">
        <header className="practice-header">
          <div className="practice-title-lockup">
            <span className="practice-header-icon"><BookOpenCheck size={21} /></span>
            <div>
              <h2 id="practice-title">Practice Lab</h2>
              <p>Learn, test, submit, and visualize verified solutions.</p>
            </div>
          </div>
          <div className="practice-header-progress">
            {user && progress ? (
              <>
                <Target size={15} />
                <strong>{progress.solvedCount}/{progress.problemCount}</strong>
                <span>solved</span>
              </>
            ) : <span>Public practice · Sign in to save progress</span>}
          </div>
          <button className="practice-close" type="button" onClick={onClose} aria-label="Close Practice Lab">
            <X size={19} />
          </button>
        </header>

        <div className="practice-body">
          <aside className="practice-catalog" aria-label="Practice problem catalog">
            <div className="practice-filter-heading"><Filter size={14} /><span>Find a challenge</span></div>
            <div className="practice-filters">
              <AccessibleSelect
                value={difficulty}
                options={DIFFICULTY_OPTIONS}
                onChange={setDifficulty}
                ariaLabel="Filter by difficulty"
                menuAlign="start"
                size="compact"
              />
              <AccessibleSelect
                value={languageFilter}
                options={filterLanguageOptions}
                onChange={setLanguageFilter}
                ariaLabel="Filter by language"
                menuAlign="start"
                size="compact"
              />
            </div>
            <div className="practice-problem-list">
              {busy === "catalog" && <p className="practice-empty">Loading challenges…</p>}
              {!busy && problems.length === 0 && <p className="practice-empty">No matching challenges.</p>}
              {problems.map((item) => (
                <button
                  type="button"
                  key={item.slug}
                  className={item.slug === selectedSlug ? "practice-problem is-selected" : "practice-problem"}
                  onClick={() => setSelectedSlug(item.slug)}
                >
                  <span className={`practice-difficulty is-${item.difficulty}`}>{item.difficulty}</span>
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                  <span className="practice-topic-row">
                    {item.topics.slice(0, 3).map((topic) => <em key={topic}>{topic}</em>)}
                  </span>
                </button>
              ))}
            </div>
            {user && submissions.length > 0 && (
              <div className="practice-recent">
                <h3><History size={14} /> Recent submissions</h3>
                {submissions.slice(0, 4).map((item) => (
                  <div key={item.id || item._id}>
                    <span>{item.problemTitle}</span>
                    <strong className={`is-${item.verdict}`}>{formatPracticeVerdict(item.verdict)}</strong>
                    <small>{formatPlatformDate(item.createdAt)}</small>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <main className="practice-workspace">
            {!problem || busy === "problem" ? (
              <div className="practice-loading"><span className="loading-spinner" /><p>Preparing challenge…</p></div>
            ) : (
              <>
                <section className="practice-brief">
                  <div>
                    <span className={`practice-difficulty is-${problem.difficulty}`}>{problem.difficulty}</span>
                    <h3>{problem.title}</h3>
                    <p>{problem.description}</p>
                  </div>
                  <div className="practice-brief-meta">
                    <span><Beaker size={14} /> {problem.publicTestCount} public tests</span>
                    <span><LockKeyhole size={14} /> {problem.hiddenTestCount} hidden tests</span>
                  </div>
                  <ul>{problem.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
                </section>

                <section className="practice-solution">
                  <div className="practice-solution-toolbar">
                    <div>
                      <span className="panel-eyebrow">YOUR SOLUTION</span>
                      <strong>{getLanguageOption(solutionLanguage).filename}</strong>
                    </div>
                    <AccessibleSelect
                      value={solutionLanguage}
                      options={supportedLanguageOptions}
                      onChange={changeSolutionLanguage}
                      ariaLabel="Solution language"
                      size="compact"
                    />
                  </div>
                  <div className="practice-editor">
                    <Editor
                      height="100%"
                      language={getLanguageOption(solutionLanguage).editorLanguage}
                      value={source}
                      theme="codeflow-midnight"
                      onChange={(value) => setSource(value || "")}
                      options={{
                        automaticLayout: true,
                        minimap: { enabled: false },
                        fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                        fontSize: 14,
                        lineHeight: 24,
                        padding: { top: 14, bottom: 14 },
                        scrollBeyondLastLine: false,
                        wordWrap: "on"
                      }}
                    />
                  </div>
                  <div className="practice-actions">
                    <button type="button" className="practice-run" disabled={Boolean(busy)} onClick={() => evaluate("run")}>
                      <Play size={15} /> {busy === "run" ? "Running public tests…" : "Run public tests"}
                    </button>
                    <button type="button" className="practice-submit" disabled={Boolean(busy)} onClick={() => evaluate("submit")}>
                      <Send size={15} /> {busy === "submit" ? "Judging…" : "Submit solution"}
                    </button>
                    {!user && (
                      <button type="button" className="practice-signin" onClick={onOpenAccount}>
                        Sign in to track progress <ArrowLeft size={13} />
                      </button>
                    )}
                  </div>
                </section>

                {(error || result) && (
                  <section className="practice-results" aria-live="polite">
                    {error ? (
                      <div className="practice-result-error"><CircleAlert size={18} /><span>{error}</span></div>
                    ) : (
                      <>
                        <div className={`practice-verdict is-${result.verdict}`}>
                          {result.verdict === "accepted" ? <Award size={20} /> : <CircleAlert size={20} />}
                          <div>
                            <span>{result.mode === "submit" ? "Submission verdict" : "Public test result"}</span>
                            <strong>{formatPracticeVerdict(result.verdict)}</strong>
                          </div>
                          <em>{result.passedCount}/{result.totalCount} passed</em>
                        </div>
                        <div className="practice-test-grid">
                          {result.results.map((test) => (
                            <article key={`${test.visibility}-${test.index}`} className={test.passed ? "is-passed" : "is-failed"}>
                              {test.passed ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
                              <div>
                                <strong>{test.label}</strong>
                                <span>{formatPracticeVerdict(test.verdict)}</span>
                                {test.visibility === "hidden" && <small>Hidden values stay server-side.</small>}
                                {test.visibility === "public" && !test.passed && (
                                  <small>Expected: {String(test.expected)} · Received: {String(test.actual)}</small>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                        {result.visualization && (
                          <button type="button" className="practice-visualize" onClick={() => onVisualize(result.visualization)}>
                            <Eye size={16} /> Visualize public test trace <Sparkles size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}
