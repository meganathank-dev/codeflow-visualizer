"use strict";

const PRACTICE_PROBLEMS = Object.freeze([
  {
    slug: "sum-two-numbers",
    title: "Sum Two Numbers",
    summary: "Read two integers and print their sum.",
    description: "Read two signed integers from separate input lines and print exactly one integer: their sum.",
    difficulty: "easy",
    topics: ["input", "arithmetic"],
    languages: ["javascript", "python", "java"],
    constraints: ["-1,000,000 ≤ each number ≤ 1,000,000", "Print only the resulting integer."],
    starterCode: {
      javascript: [
        'const first = Number(prompt(""));',
        'const second = Number(prompt(""));',
        "",
        "// Print their sum."
      ].join("\n"),
      python: [
        "first = int(input())",
        "second = int(input())",
        "",
        "# Print their sum."
      ].join("\n"),
      java: [
        "import java.util.Scanner;",
        "",
        "public class Main {",
        "  public static void main(String[] args) {",
        "    Scanner input = new Scanner(System.in);",
        "    int first = Integer.parseInt(input.nextLine());",
        "    int second = Integer.parseInt(input.nextLine());",
        "    // Print their sum.",
        "  }",
        "}"
      ].join("\n")
    },
    tests: [
      { label: "Positive values", visibility: "public", inputs: ["12", "8"], expectedOutput: "20" },
      { label: "Mixed signs", visibility: "hidden", inputs: ["-40", "15"], expectedOutput: "-25" },
      { label: "Zero values", visibility: "hidden", inputs: ["0", "0"], expectedOutput: "0" }
    ]
  },
  {
    slug: "factorial-value",
    title: "Factorial Value",
    summary: "Compute n factorial for a small non-negative integer.",
    description: "Read n and print n! where 0! is 1. An iterative or recursive solution is accepted.",
    difficulty: "easy",
    topics: ["loops", "recursion", "math"],
    languages: ["javascript", "python", "java"],
    constraints: ["0 ≤ n ≤ 10", "Print only the factorial value."],
    starterCode: {
      javascript: [
        'const n = Number(prompt(""));',
        "let result = 1;",
        "",
        "// Compute n! and print result."
      ].join("\n"),
      python: [
        "n = int(input())",
        "result = 1",
        "",
        "# Compute n! and print result."
      ].join("\n"),
      java: [
        "import java.util.Scanner;",
        "",
        "public class Main {",
        "  public static void main(String[] args) {",
        "    Scanner input = new Scanner(System.in);",
        "    int n = Integer.parseInt(input.nextLine());",
        "    int result = 1;",
        "    // Compute n! and print result.",
        "  }",
        "}"
      ].join("\n")
    },
    tests: [
      { label: "Typical factorial", visibility: "public", inputs: ["5"], expectedOutput: "120" },
      { label: "Zero factorial", visibility: "hidden", inputs: ["0"], expectedOutput: "1" },
      { label: "Larger value", visibility: "hidden", inputs: ["8"], expectedOutput: "40320" }
    ]
  },
  {
    slug: "palindrome-check",
    title: "Palindrome Check",
    summary: "Determine whether a word reads the same backwards.",
    description: "Read one lowercase word. Print YES when it is a palindrome; otherwise print NO.",
    difficulty: "medium",
    topics: ["strings", "two-pointers"],
    languages: ["javascript", "python", "java"],
    constraints: ["1 ≤ word length ≤ 100", "Input contains lowercase English letters only.", "Output exactly YES or NO."],
    starterCode: {
      javascript: [
        'const word = prompt("");',
        "",
        "// Print YES or NO."
      ].join("\n"),
      python: [
        "word = input()",
        "",
        "# Print YES or NO."
      ].join("\n"),
      java: [
        "import java.util.Scanner;",
        "",
        "public class Main {",
        "  public static void main(String[] args) {",
        "    Scanner input = new Scanner(System.in);",
        "    String word = input.nextLine();",
        "    // Print YES or NO.",
        "  }",
        "}"
      ].join("\n")
    },
    tests: [
      { label: "Palindrome word", visibility: "public", inputs: ["level"], expectedOutput: "YES" },
      { label: "Non-palindrome word", visibility: "hidden", inputs: ["codeflow"], expectedOutput: "NO" },
      { label: "Single character", visibility: "hidden", inputs: ["x"], expectedOutput: "YES" }
    ]
  },
  {
    slug: "high-scoring-students",
    title: "High-Scoring Students",
    summary: "Filter and order rows from the teaching database.",
    description: "Return name and marks for students scoring at least 80, ordered by marks from highest to lowest.",
    difficulty: "medium",
    topics: ["sql", "filtering", "sorting"],
    languages: ["sql"],
    constraints: ["Use the students table.", "Return only name and marks.", "Order by marks descending."],
    starterCode: {
      sql: [
        "SELECT name, marks",
        "FROM students",
        "-- Add filtering and ordering."
      ].join("\n")
    },
    tests: [
      {
        label: "Expected relational result",
        visibility: "public",
        inputs: [],
        expectedRows: [
          { name: "Divya", marks: 92 },
          { name: "Nila", marks: 88 },
          { name: "Kavin", marks: 84 }
        ]
      }
    ]
  }
]);

function findPracticeProblem(slug) {
  return PRACTICE_PROBLEMS.find((problem) => problem.slug === slug) || null;
}

function publicTest(test) {
  return {
    label: test.label,
    inputs: [...test.inputs],
    ...(test.expectedOutput === undefined ? {} : { expectedOutput: test.expectedOutput }),
    ...(test.expectedRows === undefined ? {} : { expectedRows: structuredClone(test.expectedRows) })
  };
}

function summarizeProblem(problem) {
  return {
    slug: problem.slug,
    title: problem.title,
    summary: problem.summary,
    difficulty: problem.difficulty,
    topics: [...problem.topics],
    languages: [...problem.languages],
    publicTestCount: problem.tests.filter((test) => test.visibility === "public").length,
    hiddenTestCount: problem.tests.filter((test) => test.visibility === "hidden").length
  };
}

function presentProblem(problem) {
  return {
    ...summarizeProblem(problem),
    description: problem.description,
    constraints: [...problem.constraints],
    starterCode: { ...problem.starterCode },
    examples: problem.tests
      .filter((test) => test.visibility === "public")
      .map(publicTest)
  };
}

function listPracticeProblems(filters = {}) {
  return PRACTICE_PROBLEMS
    .filter((problem) => !filters.difficulty || problem.difficulty === filters.difficulty)
    .filter((problem) => !filters.language || problem.languages.includes(filters.language))
    .filter((problem) => !filters.topic || problem.topics.includes(filters.topic))
    .map(summarizeProblem);
}

module.exports = {
  PRACTICE_PROBLEMS,
  findPracticeProblem,
  listPracticeProblems,
  presentProblem,
  summarizeProblem
};
