import {
  Activity,
  ChevronDown,
  Code2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import {
  LANGUAGE_OPTIONS
} from "../data/demo-executions";

export default function AppHeader({
  language,

  onLanguageChange,

  isPlaying,

  onPreview,

  onPause
}) {
  const selectedLanguage = LANGUAGE_OPTIONS.find(
    (item) => item.id === language
  );

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Code2
            size={21}
            strokeWidth={2.15}
          />

          <span className="brand-mark-pulse" />
        </div>

        <div className="brand-copy">
          <span className="brand-name">
            CodeFlow
          </span>

          <span className="brand-subtitle">
            Execution Visualizer
          </span>
        </div>

        <span className="workspace-separator" />

        <div className="workspace-indicator">
          <Activity size={15} />

          <span>
            Interactive workspace
          </span>
        </div>
      </div>

      <div className="header-actions">
        <div className="security-indicator">
          <ShieldCheck size={15} />

          <span>
            Preview environment
          </span>
        </div>

        <label className="language-selector">
          <span
            className="language-dot"
            style={{
              "--language-color": selectedLanguage.color
            }}
          />

          <select
            value={language}
            onChange={(event) => {
              onLanguageChange(
                event.target.value
              );
            }}
            aria-label="Programming language"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown
            className="language-chevron"
            size={15}
          />
        </label>

        <button
          className={
            isPlaying
              ? "primary-action is-playing"
              : "primary-action"
          }
          type="button"
          onClick={
            isPlaying
              ? onPause
              : onPreview
          }
        >
          {
            isPlaying
              ? <Pause size={16} />
              : <Play size={16} />
          }

          <span>
            {
              isPlaying
                ? "Pause"
                : "Preview demo"
            }
          </span>

          {
            !isPlaying && (
              <Sparkles
                className="action-sparkle"
                size={14}
              />
            )
          }
        </button>
      </div>
    </header>
  );
}