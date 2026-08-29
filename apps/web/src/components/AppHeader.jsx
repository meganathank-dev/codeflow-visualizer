import {
  Activity,
  ChevronDown,
  Code2,
  LoaderCircle,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";

import { LANGUAGE_OPTIONS } from "../data/demo-executions";
import { getPrimaryActionLabel } from "../utils/playback";

export default function AppHeader({
  language,
  onLanguageChange,
  isPlaying,
  isExecuting,
  hasLiveExecution,
  supportsLiveExecution,
  isAtFirstStep,
  isAtFinalStep,
  user,
  onAccount,
  onRun,
  onPause
}) {
  const selectedLanguage = LANGUAGE_OPTIONS.find((item) => item.id === language);
  const actionLabel = getPrimaryActionLabel({
    isExecuting,
    isPlaying,
    supportsLiveExecution,
    hasLiveExecution,
    isAtFirstStep,
    isAtFinalStep
  });

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Code2 size={21} strokeWidth={2.15} />
          <span className="brand-mark-pulse" />
        </div>

        <div className="brand-copy">
          <span className="brand-name">CodeFlow</span>
          <span className="brand-subtitle">Execution Visualizer</span>
        </div>

        <span className="workspace-separator" />

        <div className="workspace-indicator">
          <Activity size={15} />
          <span>Interactive workspace</span>
        </div>
      </div>

      <div className="header-actions">
        <div className="security-indicator">
          <ShieldCheck size={15} />
          <span>{supportsLiveExecution ? "Local execution" : "Preview environment"}</span>
        </div>

        <button
          className="account-action"
          type="button"
          onClick={onAccount}
          aria-label={user ? `Open ${user.name}'s account` : "Sign in to CodeFlow"}
        >
          <UserRound size={15} />
          <span>{user ? user.name.split(" ")[0] : "Sign in"}</span>
        </button>

        <label className="language-selector">
          <span
            className="language-dot"
            style={{ "--language-color": selectedLanguage.color }}
          />

          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            aria-label="Programming language"
            disabled={isExecuting}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown className="language-chevron" size={15} />
        </label>

        <button
          className={isPlaying ? "primary-action is-playing" : "primary-action"}
          type="button"
          onClick={isPlaying ? onPause : onRun}
          disabled={isExecuting}
          aria-busy={isExecuting}
          style={isExecuting ? { opacity: 0.8 } : undefined}
        >
          {isExecuting ? (
            <LoaderCircle
              size={16}
              style={{ animation: "spin 760ms linear infinite" }}
            />
          ) : isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}

          <span>{actionLabel}</span>

          {!isPlaying && !isExecuting && (
            <Sparkles className="action-sparkle" size={14} />
          )}
        </button>
      </div>
    </header>
  );
}
