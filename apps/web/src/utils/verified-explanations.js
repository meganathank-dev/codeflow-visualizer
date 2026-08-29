const CONTROL_KEYWORDS = Object.freeze({
  javascript: { function: /^(?:async\s+)?function\b|=>\s*\{?$/, output: /\bconsole\.(?:log|warn|error)\s*\(/, input: /\bprompt\s*\(/ },
  python: { function: /^def\s+/, output: /^print\s*\(/, input: /\binput\s*\(/ },
  java: { function: /^(?:public|private|protected|static|final|synchronized|native|abstract|\s)+[\w<>\[\], ?]+\s+\w+\s*\([^;]*\)\s*\{?$/, output: /\bSystem\.out\.print/, input: /\b(?:nextLine|nextInt|nextDouble|next)\s*\(/ },
  sql: { function: /^$/, output: /^SELECT\b/i, input: /^$/ }
});

function statementWithoutComment(line, language) {
  if (language === "python") return line.split("#")[0].trim();
  if (language === "sql") return line.replace(/--.*$/, "").trim();
  return line.replace(/\/\/.*$/, "").trim();
}

export function explainSourceLine(line, language = "javascript") {
  const statement = statementWithoutComment(String(line || ""), language);
  const patterns = CONTROL_KEYWORDS[language] || CONTROL_KEYWORDS.javascript;

  if (!statement) return "This line only adds spacing or a comment and does not execute by itself.";
  if (/^[}\])]+;?$/.test(statement) || statement === "end") {
    return "Closes the current code block, function, loop, conditional, or collection definition.";
  }
  if (/^(?:import|from\s+\S+\s+import|package)\b/.test(statement)) {
    return "Makes an external module, package, or library feature available to this program.";
  }
  if (/^(?:public\s+)?class\b/.test(statement)) {
    return "Declares a class that groups the program's methods and data.";
  }
  if (patterns.function.test(statement)) {
    return "Declares a reusable function or method and defines the parameters it receives.";
  }
  if (/^(?:if|elif|else\s+if)\b|^if\s*\(/.test(statement)) {
    return "Evaluates a condition and enters this branch only when its result allows it.";
  }
  if (/^else\b/.test(statement)) {
    return "Starts the fallback branch used when the preceding condition is false.";
  }
  if (/^(?:for|while)\b/.test(statement)) {
    return "Controls a loop by establishing or checking the next iteration.";
  }
  if (/^(?:try|catch|except|finally|throw|raise)\b/.test(statement)) {
    return "Participates in error handling by starting, catching, finalizing, or raising an exception.";
  }
  if (/^return\b/.test(statement)) {
    return "Ends the current function call and sends its computed value back to the caller.";
  }
  if (patterns.input.test(statement)) {
    return "Pauses execution to request one input value and stores or converts the confirmed response.";
  }
  if (patterns.output.test(statement)) {
    return "Writes the evaluated value to the program console.";
  }
  if (/^(?:const|let|var|int|double|float|long|boolean|String|char|list|dict|set|tuple)\b/.test(statement) || /^[A-Za-z_$][\w$]*(?:\[[^\]]+\])?\s*(?:=|\+=|-=|\*=|\/=)/.test(statement)) {
    return /\[[^\]]*\]|\{[^}]*\}/.test(statement)
      ? "Creates or updates a named value using the collection shown on this line."
      : "Creates or updates a variable with the value produced by the expression on this line.";
  }
  if (/^(?:SELECT|WITH)\b/i.test(statement)) return "Defines the rows and columns that the SQL query will return.";
  if (/^(?:FROM|JOIN)\b/i.test(statement)) return "Chooses or combines the table data used by the SQL query.";
  if (/^(?:WHERE|HAVING)\b/i.test(statement)) return "Filters rows by evaluating the condition on this line.";
  if (/^(?:GROUP BY|ORDER BY|LIMIT)\b/i.test(statement)) return "Shapes the SQL result by grouping, sorting, or limiting its rows.";
  if (/\w+\s*\([^)]*\)/.test(statement)) return "Calls a function or method with the supplied arguments and uses its result if required.";
  return "Executes this statement as part of the surrounding program flow.";
}

export function createLineExplanations(source, language, steps = []) {
  const eventsByLine = new Map();

  steps.forEach((step, index) => {
    if (!Number.isInteger(step?.line) || step.line < 1) return;
    const events = eventsByLine.get(step.line) || [];
    events.push({ number: index + 1, event: step.event, title: step.title });
    eventsByLine.set(step.line, events);
  });

  return String(source || "").split(/\r?\n/).map((code, index) => {
    const line = index + 1;
    const events = eventsByLine.get(line) || [];
    return {
      line,
      code,
      explanation: explainSourceLine(code, language),
      executed: events.length > 0,
      eventNumbers: events.map((item) => item.number),
      events
    };
  });
}

export function createNumberedEventTrace(steps = []) {
  return steps.map((step, index) => ({
    number: index + 1,
    index,
    event: String(step?.event || "UNKNOWN_EVENT"),
    line: Number.isInteger(step?.line) ? step.line : null,
    title: String(step?.title || "Execution event"),
    description: String(step?.description || "No event explanation is available."),
    hasError: Boolean(step?.error)
  }));
}

export function createVerifiedExplanationRequest({ verificationId, mode, eventIndex, question }) {
  return {
    verificationId: String(verificationId || ""),
    mode,
    eventIndex: Number.isInteger(eventIndex) ? eventIndex : 0,
    ...(question?.trim() ? { question: question.trim() } : {})
  };
}
