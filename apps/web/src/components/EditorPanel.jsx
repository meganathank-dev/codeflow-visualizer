import {
  useEffect,
  useRef
} from "react";

import Editor from "@monaco-editor/react";

import {
  Braces,
  FileCode2,
  RotateCcw
} from "lucide-react";

export default function EditorPanel({
  language,
  source,
  currentLine,
  isEdited,
  executionMode,
  onChange,
  onRestore
}) {
  const editorRef =
    useRef(null);

  const monacoRef =
    useRef(null);

  const decorationsRef =
    useRef(null);

  function updateLineHighlight(lineNumber) {
    if (
      !editorRef.current ||
      !monacoRef.current
    ) {
      return;
    }

    const model =
      editorRef.current.getModel();

    if (!model) {
      return;
    }

    if (
      !Number.isInteger(lineNumber) ||
      lineNumber < 1 ||
      lineNumber > model.getLineCount()
    ) {
      decorationsRef.current?.clear();

      return;
    }

    const decoration = {
      range:
        new monacoRef.current.Range(
          lineNumber,
          1,
          lineNumber,
          1
        ),

      options: {
        isWholeLine:
          true,

        className:
          "codeflow-current-line",

        glyphMarginClassName:
          "codeflow-current-line-glyph",

        overviewRuler: {
          color:
            "#66e2b3",

          position:
            monacoRef.current.editor.OverviewRulerLane.Full
        }
      }
    };

    if (
      !decorationsRef.current
    ) {
      decorationsRef.current =
        editorRef.current.createDecorationsCollection();
    }

    decorationsRef.current.set([
      decoration
    ]);

    editorRef.current.revealLineInCenterIfOutsideViewport(
      lineNumber
    );
  }

  function handleEditorMount(
    editor,
    monaco
  ) {
    editorRef.current =
      editor;

    monacoRef.current =
      monaco;

    monaco.editor.defineTheme(
      "codeflow-midnight",

      {
        base:
          "vs-dark",

        inherit:
          true,

        rules: [
          {
            token:
              "comment",

            foreground:
              "66728d",

            fontStyle:
              "italic"
          },

          {
            token:
              "keyword",

            foreground:
              "a78bfa"
          },

          {
            token:
              "string",

            foreground:
              "7ee0b0"
          },

          {
            token:
              "number",

            foreground:
              "f6c177"
          },

          {
            token:
              "type",

            foreground:
              "79b8ff"
          }
        ],

        colors: {
          "editor.background":
            "#0c1019",

          "editor.foreground":
            "#dce4f2",

          "editorLineNumber.foreground":
            "#48536a",

          "editorLineNumber.activeForeground":
            "#aebbd1",

          "editorCursor.foreground":
            "#78e7bb",

          "editor.selectionBackground":
            "#243b53",

          "editor.inactiveSelectionBackground":
            "#1a2638",

          "editor.lineHighlightBackground":
            "#111927",

          "editorIndentGuide.background1":
            "#202b3a",

          "editorIndentGuide.activeBackground1":
            "#35455c",

          "editorGutter.background":
            "#0c1019"
        }
      }
    );

    monaco.editor.setTheme(
      "codeflow-midnight"
    );

    updateLineHighlight(
      currentLine
    );
  }

  useEffect(
    () => {
      updateLineHighlight(
        currentLine
      );
    },

    [
      currentLine,
      language.id
    ]
  );

  let filebarNote =
    "Curated preview";

  if (
    executionMode === "live"
  ) {
    filebarNote =
      "Verified execution";
  } else if (
    executionMode === "ready"
  ) {
    filebarNote =
      isEdited
        ? "Ready to run"
        : "JavaScript ready";
  } else if (
    isEdited
  ) {
    filebarNote =
      "Modified sample";
  }

  return (
    <section className="workspace-panel editor-panel">
      <div className="panel-heading">
        <div className="panel-heading-copy">
          <div className="panel-icon editor-icon">
            <Braces size={17} />
          </div>

          <div>
            <p className="panel-eyebrow">
              SOURCE
            </p>

            <h2 className="panel-title">
              Code editor
            </h2>
          </div>
        </div>

        <div className="panel-heading-actions">
          {
            isEdited && (
              <button
                className="restore-button"
                type="button"
                onClick={onRestore}
              >
                <RotateCcw size={14} />

                <span>
                  Restore example
                </span>
              </button>
            )
          }

          <span className="editor-language-badge">
            {
              language.shortLabel
            }
          </span>
        </div>
      </div>

      <div className="editor-filebar">
        <div className="editor-filetab">
          <FileCode2 size={15} />

          <span>
            {
              language.filename
            }
          </span>

          {
            isEdited && (
              <span
                className="unsaved-indicator"
                aria-label="File modified"
              />
            )
          }
        </div>

        <span className="filebar-note">
          {
            filebarNote
          }
        </span>
      </div>

      <div className="editor-container">
        <Editor
          height="100%"
          language={
            language.editorLanguage
          }
          value={source}
          theme="codeflow-midnight"
          onMount={
            handleEditorMount
          }
          onChange={
            (value) => {
              onChange(
                value || ""
              );
            }
          }
          loading={
            <div className="editor-loading">
              <span className="loading-spinner" />

              <span>
                Loading Monaco Editor...
              </span>
            </div>
          }
          options={{
            automaticLayout:
              true,

            fontFamily:
              '"Cascadia Code", "Fira Code", Consolas, monospace',

            fontSize:
              14,

            fontLigatures:
              true,

            lineHeight:
              25,

            padding: {
              top:
                18,

              bottom:
                18
            },

            minimap: {
              enabled:
                false
            },

            scrollBeyondLastLine:
              false,

            smoothScrolling:
              true,

            cursorBlinking:
              "smooth",

            cursorSmoothCaretAnimation:
              "on",

            glyphMargin:
              true,

            lineNumbersMinChars:
              3,

            renderLineHighlight:
              "none",

            overviewRulerBorder:
              false,

            hideCursorInOverviewRuler:
              true,

            folding:
              true,

            wordWrap:
              "on",

            scrollbar: {
              verticalScrollbarSize:
                8,

              horizontalScrollbarSize:
                8
            }
          }}
        />
      </div>

      <div className="editor-statusbar">
        <span>
          {
            currentLine
              ? `Current line ${currentLine}`
              : "No active execution line"
          }
        </span>

        <span>
          UTF-8
        </span>

        <span>
          {
            language.label
          }
        </span>
      </div>
    </section>
  );
}