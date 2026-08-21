const PROGRAM_VALUES = Object.freeze([
  4,
  8,
  12
]);

const STUDENT_ROWS = Object.freeze([
  {
    id: 1,
    name: "Arun",
    marks: 72
  },
  {
    id: 2,
    name: "Divya",
    marks: 92
  },
  {
    id: 3,
    name: "Nila",
    marks: 88
  },
  {
    id: 4,
    name: "Kavin",
    marks: 84
  },
  {
    id: 5,
    name: "Manoj",
    marks: 65
  }
]);

function clone(value) {
  return structuredClone(value);
}

function createProgramSteps({
  language,
  lines,
  indexName,
  itemName,
  stackMethod,
  outputMethod
}) {
  const steps = [];

  const numbers = clone(
    PROGRAM_VALUES
  );

  let total = 0;

  let stack = [];

  let consoleEntries = [];

  const frameName = language === "java"
    ? "main(String[] args)"
    : language === "python"
      ? "<module>"
      : "main()";

  function addStep({
    line,
    event,
    title,
    description,
    activeIndex = null,
    iteration = null,
    condition = null,
    extraVariables = {}
  }) {
    const variables = {
      numbers: clone(numbers),
      stack: clone(stack),
      ...extraVariables
    };

    if (
      event !== "ARRAY_CREATE" &&
      event !== "STACK_CREATE"
    ) {
      variables.total = total;
    }

    steps.push({
      id: `${language}-step-${steps.length}`,

      line,

      event,

      title,

      description,

      variables,

      array: {
        name: "numbers",
        values: clone(numbers),
        activeIndex
      },

      stack: {
        name: "stack",
        values: clone(stack)
      },

      callStack: [
        {
          name: frameName,
          line
        }
      ],

      console: clone(
        consoleEntries
      ),

      iteration,

      condition,

      sql: null
    });
  }

  addStep({
    line: lines.array,

    event: "ARRAY_CREATE",

    title: "Create the numbers collection",

    description: (
      "The program creates a collection containing 4, 8, and 12."
    )
  });

  addStep({
    line: lines.stack,

    event: "STACK_CREATE",

    title: "Create an empty stack",

    description: (
      "An empty stack is prepared to store the processed values."
    )
  });

  addStep({
    line: lines.total,

    event: "VARIABLE_DECLARE",

    title: "Initialize total",

    description: (
      "The total variable starts at 0."
    )
  });

  for (
    let index = 0;
    index < numbers.length;
    index += 1
  ) {
    const currentValue = numbers[index];

    const loopVariables = {
      [indexName]: index
    };

    if (itemName) {
      loopVariables[itemName] = currentValue;
    }

    addStep({
      line: lines.loop,

      event: "LOOP_ITERATION",

      title: `Start iteration ${index + 1}`,

      description: (
        `The loop selects the value ${currentValue} at index ${index}.`
      ),

      activeIndex: index,

      iteration: index + 1,

      condition: {
        expression: `${index} < ${numbers.length}`,
        result: true
      },

      extraVariables: loopVariables
    });

    total += currentValue;

    addStep({
      line: lines.update,

      event: "VARIABLE_UPDATE",

      title: `Update total to ${total}`,

      description: (
        `The current value ${currentValue} is added to total.`
      ),

      activeIndex: index,

      iteration: index + 1,

      extraVariables: loopVariables
    });

    stack = [
      ...stack,
      currentValue
    ];

    addStep({
      line: lines.push,

      event: "STACK_PUSH",

      title: `Push ${currentValue} onto the stack`,

      description: (
        `${stackMethod} adds ${currentValue} as the new top element.`
      ),

      activeIndex: index,

      iteration: index + 1,

      extraVariables: loopVariables
    });
  }

  consoleEntries = [
    {
      channel: "stdout",
      text: "Total: 24"
    }
  ];

  addStep({
    line: lines.output,

    event: "OUTPUT",

    title: "Write the final output",

    description: (
      `${outputMethod} prints the completed total of 24.`
    )
  });

  return steps;
}

function createSqlSteps() {
  const allRows = clone(
    STUDENT_ROWS
  );

  const matchingRows = allRows.filter(
    (row) => row.marks > 80
  );

  const sortedRows = clone(
    matchingRows
  ).sort(
    (first, second) => second.marks - first.marks
  );

  const projectedRows = sortedRows.map(
    ({
      name,
      marks
    }) => ({
      name,
      marks
    })
  );

  function step({
    line,
    event,
    title,
    description,
    rows,
    displayRows = rows,
    columns,
    rejectedIds = [],
    operation,
    output = []
  }) {
    return {
      id: `sql-step-${event.toLowerCase()}`,

      line,

      event,

      title,

      description,

      variables: {},

      array: null,

      stack: null,

      callStack: [],

      console: clone(
        output
      ),

      iteration: null,

      condition: null,

      sql: {
        table: "students",

        rows: clone(
          rows
        ),

        displayRows: clone(
          displayRows
        ),

        columns: clone(
          columns
        ),

        rejectedIds: clone(
          rejectedIds
        ),

        operation,

        scannedCount: allRows.length,

        matchingCount: matchingRows.length,

        rejectedCount: (
          allRows.length - matchingRows.length
        )
      }
    };
  }

  return [
    step({
      line: 1,

      event: "SQL_QUERY_START",

      title: "Prepare the query",

      description: (
        "The query requests student names and marks from the students table."
      ),

      rows: allRows,

      columns: [
        "id",
        "name",
        "marks"
      ],

      operation: "Query initialization"
    }),

    step({
      line: 2,

      event: "SQL_SCAN",

      title: "Scan the students table",

      description: (
        "The logical visualization reads the five available student rows."
      ),

      rows: allRows,

      columns: [
        "id",
        "name",
        "marks"
      ],

      operation: "Table scan"
    }),

    step({
      line: 3,

      event: "SQL_FILTER",

      title: "Filter marks greater than 80",

      description: (
        "Three rows satisfy the condition and two rows are excluded."
      ),

      rows: matchingRows,

      displayRows: allRows,

      columns: [
        "id",
        "name",
        "marks"
      ],

      rejectedIds: [
        1,
        5
      ],

      operation: "WHERE marks > 80"
    }),

    step({
      line: 1,

      event: "SQL_PROJECT",

      title: "Select requested columns",

      description: (
        "Only the name and marks columns are retained in the logical result."
      ),

      rows: matchingRows,

      columns: [
        "name",
        "marks"
      ],

      operation: "SELECT name, marks"
    }),

    step({
      line: 4,

      event: "SQL_SORT",

      title: "Sort by marks",

      description: (
        "The matching rows are ordered from highest marks to lowest marks."
      ),

      rows: sortedRows,

      columns: [
        "name",
        "marks"
      ],

      operation: "ORDER BY marks DESC"
    }),

    step({
      line: 5,

      event: "SQL_LIMIT",

      title: "Restrict the result",

      description: (
        "The result is limited to the first three matching rows."
      ),

      rows: projectedRows,

      columns: [
        "name",
        "marks"
      ],

      operation: "LIMIT 3"
    }),

    step({
      line: 1,

      event: "SQL_RESULT",

      title: "Produce the final result",

      description: (
        "The query returns Divya, Nila, and Kavin in descending mark order."
      ),

      rows: projectedRows,

      columns: [
        "name",
        "marks"
      ],

      operation: "Final result",

      output: [
        {
          channel: "result",
          text: "3 rows returned"
        }
      ]
    })
  ];
}

export const LANGUAGE_OPTIONS = [
  {
    id: "javascript",
    label: "JavaScript",
    shortLabel: "JS",
    editorLanguage: "javascript",
    color: "#f4d35e",
    filename: "main.js"
  },

  {
    id: "python",
    label: "Python",
    shortLabel: "PY",
    editorLanguage: "python",
    color: "#58a6ff",
    filename: "main.py"
  },

  {
    id: "java",
    label: "Java",
    shortLabel: "JV",
    editorLanguage: "java",
    color: "#ff866c",
    filename: "Main.java"
  },

  {
    id: "sql",
    label: "SQL",
    shortLabel: "SQL",
    editorLanguage: "sql",
    color: "#58d6a5",
    filename: "students.sql"
  }
];

const JAVASCRIPT_SOURCE = `const numbers = [4, 8, 12];
const stack = [];
let total = 0;

for (let i = 0; i < numbers.length; i++) {
  total += numbers[i];
  stack.push(numbers[i]);
}

console.log("Total:", total);`;

const PYTHON_SOURCE = `numbers = [4, 8, 12]
stack = []
total = 0

for index, number in enumerate(numbers):
    total += number
    stack.append(number)

print("Total:", total)`;

const JAVA_SOURCE = `import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    public static void main(String[] args) {
        int[] numbers = {4, 8, 12};
        Deque<Integer> stack = new ArrayDeque<>();
        int total = 0;

        for (int i = 0; i < numbers.length; i++) {
            total += numbers[i];
            stack.push(numbers[i]);
        }

        System.out.println("Total: " + total);
    }
}`;

const SQL_SOURCE = `SELECT name, marks
FROM students
WHERE marks > 80
ORDER BY marks DESC
LIMIT 3;`;

export const DEMO_EXECUTIONS = {
  javascript: {
    source: JAVASCRIPT_SOURCE,

    steps: createProgramSteps({
      language: "javascript",

      lines: {
        array: 1,
        stack: 2,
        total: 3,
        loop: 5,
        update: 6,
        push: 7,
        output: 10
      },

      indexName: "i",

      itemName: null,

      stackMethod: "stack.push()",

      outputMethod: "console.log()"
    })
  },

  python: {
    source: PYTHON_SOURCE,

    steps: createProgramSteps({
      language: "python",

      lines: {
        array: 1,
        stack: 2,
        total: 3,
        loop: 5,
        update: 6,
        push: 7,
        output: 9
      },

      indexName: "index",

      itemName: "number",

      stackMethod: "stack.append()",

      outputMethod: "print()"
    })
  },

  java: {
    source: JAVA_SOURCE,

    steps: createProgramSteps({
      language: "java",

      lines: {
        array: 6,
        stack: 7,
        total: 8,
        loop: 10,
        update: 11,
        push: 12,
        output: 15
      },

      indexName: "i",

      itemName: null,

      stackMethod: "stack.push()",

      outputMethod: "System.out.println()"
    })
  },

  sql: {
    source: SQL_SOURCE,

    steps: createSqlSteps()
  }
};

export function getLanguageOption(languageId) {
  return LANGUAGE_OPTIONS.find(
    (language) => language.id === languageId
  );
}