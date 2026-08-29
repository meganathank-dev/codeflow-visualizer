import {
  Activity,
  Code2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Square,
  UserRound
} from "lucide-react";

import AccessibleSelect from "./AccessibleSelect";
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
  onCancel,
  onPause
}) {
  const languageOptions = LANGUAGE_OPTIONS.map((option) => ({
    value: option.id,
    label: option.label,
    description: option.filename,
    color: option.color
  }));
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

        <AccessibleSelect
          className="language-selector"
          value={language}
          options={languageOptions}
          onChange={onLanguageChange}
          ariaLabel="Programming language"
          disabled={isExecuting}
        />

        <button
          className={isExecuting ? "primary-action is-cancelling" : isPlaying ? "primary-action is-playing" : "primary-action"}
          type="button"
          onClick={isExecuting ? onCancel : isPlaying ? onPause : onRun}
          aria-busy={isExecuting}
        >
          {isExecuting ? (
            <Square size={15} fill="currentColor" />
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
