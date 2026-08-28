import { useEffect, useRef } from "react";

import { CornerDownLeft, Keyboard, X } from "lucide-react";

export default function ProgramInputDialog({
  request,
  value,
  languageLabel,
  onChange,
  onConfirm,
  onCancel
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!request) {
      return undefined;
    }

    inputRef.current?.focus();

    function handleEscape(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [request]);

  if (!request) {
    return null;
  }

  return (
    <div className="program-input-overlay" role="presentation">
      <form
        className="program-input-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-input-title"
        aria-describedby="program-input-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="program-input-dialog-heading">
          <span className="program-input-dialog-icon">
            <Keyboard size={19} />
          </span>

          <div>
            <p>PROGRAM INPUT #{request.inputNumber}</p>
            <h2 id="program-input-title">Execution paused for input</h2>
          </div>

          <button type="button" onClick={onCancel} aria-label="Cancel execution">
            <X size={17} />
          </button>
        </div>

        <div className="program-input-dialog-body">
          <span>{languageLabel} is waiting for:</span>
          <strong id="program-input-prompt">{request.prompt}</strong>

          <label htmlFor="program-input-value">Your input</label>
          <input
            ref={inputRef}
            id="program-input-value"
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="off"
            spellCheck="false"
          />

          <small>
            Press Enter to confirm. The next input appears only when the program requests it.
          </small>
        </div>

        <div className="program-input-dialog-actions">
          <button className="program-input-cancel" type="button" onClick={onCancel}>
            Cancel execution
          </button>

          <button className="program-input-confirm" type="submit">
            Confirm input
            <CornerDownLeft size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
