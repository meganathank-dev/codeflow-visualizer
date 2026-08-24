"use strict";

const assert = require("node:assert/strict");
const { assertValidTrace } = require("@codeflow/execution-trace");
const { createExecutionServer } = require("../src/server");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

function execute(baseUrl, language, source) {
  return requestJson(baseUrl, "/execute", {
    method: "POST",
    body: JSON.stringify({ language, source })
  });
}

function createJavaScriptFixture() {
  return [
    "const numbers = [2, 4, 6];",
    "const stack = [];",
    "let total = 0;",
    "",
    "for (let i = 0; i < numbers.length; i++) {",
    "  numbers[i] *= 2;",
    "  total += numbers[i];",
    "  stack.push(numbers[i]);",
    "}",
    "",
    "function summarize(value) {",
    "  return value;",
    "}",
    "",
    'console.log("Total:", summarize(total));'
  ].join("\n");
}

function createPythonFixture() {
  return [
    "def double(value):",
    "    return value * 2",
    "",
    "numbers = [2, 4, 6]",
    "stack = []",
    "total = 0",
    "",
    "for index in range(len(numbers)):",
    "    numbers[index] = double(numbers[index])",
    "    total += numbers[index]",
    "    stack.append(numbers[index])",
    "",
    "if total > 20:",
    '    print("Total:", total)'
  ].join("\n");
}

function createJavaFixture() {
  return [
    "import java.util.ArrayDeque;",
    "import java.util.Deque;",
    "",
    "public class Main {",
    "    private static int doubleValue(int value) {",
    "        return value * 2;",
    "    }",
    "",
    "    public static void main(String[] args) {",
    "        int[] numbers = {2, 4, 6};",
    "        Deque<Integer> stack = new ArrayDeque<>();",
    "        int total = 0;",
    "",
    "        for (int index = 0; index < numbers.length; index++) {",
    "            numbers[index] = doubleValue(numbers[index]);",
    "            total += numbers[index];",
    "            stack.push(numbers[index]);",
    "        }",
    "",
    "        if (total > 20) {",
    "            System.out.println(\"Total: \" + total);",
    "        }",
    "    }",
    "}"
  ].join("\n");
}

function createSqlFixture() {
  return [
    "SELECT name, marks",
    "FROM students",
    "WHERE marks > 80",
    "ORDER BY marks DESC",
    "LIMIT 3;"
  ].join("\n");
}

async function testHealth(baseUrl) {
  const health = await requestJson(baseUrl, "/health");

  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.body.service, "codeflow-execution");
  assert.equal(health.body.security.dedicatedExecutionProcess, true);
  assert.equal(health.body.security.dedicatedJavaScriptChildProcess, true);
  assert.equal(health.body.security.dedicatedPythonChildProcess, true);
  assert.equal(health.body.security.dedicatedJavaChildProcess, true);
  assert.equal(health.body.security.dedicatedSqlChildProcess, true);
  assert.equal(health.body.security.privateSqlDatabase, true);
  assert.equal(health.body.security.acceptsUntrustedCode, false);

  assert.deepEqual(health.body.executionEnabledLanguages, [
    "javascript",
    "python",
    "java",
    "sql"
  ]);
}

async function testLanguageCapabilities(baseUrl) {
  const response = await requestJson(baseUrl, "/languages");

  assert.equal(response.status, 200);
  assert.equal(response.body.languages.length, 4);

  const getLanguage = (languageId) => response.body.languages.find(
    (language) => language.id === languageId
  );

  assert.equal(getLanguage("javascript").executionEnabled, true);
  assert.equal(getLanguage("python").executionEnabled, true);
  assert.equal(getLanguage("java").executionEnabled, true);
  assert.equal(getLanguage("sql").executionEnabled, true);
  assert.equal(getLanguage("sql").domain, "query");
}

function assertRequiredEvents(trace, eventTypes) {
  for (const eventType of eventTypes) {
    assert.equal(
      trace.events.some((event) => event.type === eventType),
      true,
      `Expected execution event was missing: ${eventType}`
    );
  }
}

function assertCompletedProgram(response, language) {
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.language, language);
  assert.equal(response.body.executionStatus, "completed");

  const trace = response.body.trace;
  assertValidTrace(trace);

  assert.equal(trace.schemaVersion, "1.0.0");
  assert.equal(trace.domain, "program");
  assert.equal(trace.language, language);
  assert.equal(trace.events[0].type, "PROGRAM_START");
  assert.equal(trace.events.at(-1).type, "PROGRAM_END");
  assert.equal(response.body.states.length, trace.eventCount);
  assert.equal(response.body.summary.eventCount, trace.eventCount);
  assert.equal(response.body.security.dedicatedChildProcess, true);

  return response.body;
}

async function testRealJavaScriptExecution(baseUrl) {
  const response = await execute(baseUrl, "javascript", createJavaScriptFixture());
  const execution = assertCompletedProgram(response, "javascript");

  assertRequiredEvents(execution.trace, [
    "VARIABLE_DECLARE",
    "VARIABLE_UPDATE",
    "ARRAY_CREATE",
    "ARRAY_ACCESS",
    "ARRAY_UPDATE",
    "ARRAY_INSERT",
    "STACK_CREATE",
    "STACK_PUSH",
    "LOOP_START",
    "LOOP_CONDITION",
    "LOOP_ITERATION",
    "LOOP_END",
    "FUNCTION_CALL",
    "FUNCTION_ENTER",
    "FUNCTION_RETURN",
    "OUTPUT"
  ]);

  const finalState = execution.states.at(-1);

  assert.deepEqual(finalState.arrays.numbers, [4, 8, 12]);
  assert.deepEqual(finalState.stacks.stack, [4, 8, 12]);
  assert.equal(finalState.variables.total, 24);
  assert.equal(finalState.variables.i, 3);
  assert.equal(finalState.console.length, 1);
  assert.equal(finalState.console[0].text, "Total: 24");
  assert.equal(finalState.callStack.length, 0);

  return execution;
}

async function testRealPythonExecution(baseUrl) {
  const response = await execute(baseUrl, "python", createPythonFixture());
  const execution = assertCompletedProgram(response, "python");

  assertRequiredEvents(execution.trace, [
    "STATEMENT_EXECUTE",
    "VARIABLE_DECLARE",
    "VARIABLE_UPDATE",
    "ARRAY_CREATE",
    "ARRAY_ACCESS",
    "ARRAY_UPDATE",
    "ARRAY_INSERT",
    "STACK_CREATE",
    "STACK_PUSH",
    "LOOP_START",
    "LOOP_CONDITION",
    "LOOP_ITERATION",
    "LOOP_END",
    "CONDITION_EVALUATE",
    "BRANCH_ENTER",
    "FUNCTION_CALL",
    "FUNCTION_ENTER",
    "FUNCTION_RETURN",
    "OUTPUT"
  ]);

  const finalState = execution.states.at(-1);

  assert.deepEqual(finalState.arrays.numbers, [4, 8, 12]);
  assert.deepEqual(finalState.stacks.stack, [4, 8, 12]);
  assert.equal(finalState.variables.total, 24);
  assert.equal(finalState.variables.index, 2);
  assert.equal(finalState.console.length, 1);
  assert.equal(finalState.console[0].text, "Total: 24");
  assert.equal(finalState.callStack.length, 0);

  return execution;
}

async function testPythonEnumerate(baseUrl) {
  const source = [
    "numbers = [4, 8, 12]",
    "stack = []",
    "total = 0",
    "",
    "for index, number in enumerate(numbers):",
    "    total += number",
    "    stack.append(number)",
    "",
    'print("Total:", total)'
  ].join("\n");

  const response = await execute(baseUrl, "python", source);
  const execution = assertCompletedProgram(response, "python");
  const finalState = execution.states.at(-1);

  assert.deepEqual(finalState.arrays.numbers, [4, 8, 12]);
  assert.deepEqual(finalState.stacks.stack, [4, 8, 12]);
  assert.equal(finalState.variables.index, 2);
  assert.equal(finalState.variables.number, 12);
  assert.equal(finalState.variables.total, 24);
}

async function testRealJavaExecution(baseUrl) {
  const response = await execute(baseUrl, "java", createJavaFixture());
  const execution = assertCompletedProgram(response, "java");

  assertRequiredEvents(execution.trace, [
    "STATEMENT_EXECUTE",
    "VARIABLE_DECLARE",
    "VARIABLE_UPDATE",
    "ARRAY_CREATE",
    "ARRAY_UPDATE",
    "STACK_CREATE",
    "STACK_PUSH",
    "LOOP_START",
    "LOOP_CONDITION",
    "LOOP_ITERATION",
    "LOOP_END",
    "CONDITION_EVALUATE",
    "BRANCH_ENTER",
    "FUNCTION_CALL",
    "FUNCTION_ENTER",
    "FUNCTION_RETURN",
    "OUTPUT"
  ]);

  const finalState = execution.states.at(-1);

  assert.deepEqual(finalState.arrays.numbers, [4, 8, 12]);
  assert.deepEqual(finalState.stacks.stack, [4, 8, 12]);
  assert.equal(finalState.variables.total, 24);
  assert.equal(finalState.console.length, 1);
  assert.equal(finalState.console[0].text, "Total: 24");
  assert.equal(finalState.callStack.length, 0);

  return execution;
}

async function testCrossLanguageQueues(baseUrl) {
  const fixtures = {
    javascript: [
      "const taskQueue = [];",
      'taskQueue.push("A");',
      'taskQueue.push("B");',
      "const front = taskQueue[0];",
      "const removed = taskQueue.shift();",
      'console.log("Front:", front, "Removed:", removed);'
    ].join("\n"),
    python: [
      "task_queue = []",
      'task_queue.append("A")',
      'task_queue.append("B")',
      "front = task_queue[0]",
      "removed = task_queue.pop(0)",
      'print("Front:", front, "Removed:", removed)'
    ].join("\n"),
    java: [
      "import java.util.ArrayDeque;",
      "import java.util.Queue;",
      "",
      "public class Main {",
      "    public static void main(String[] args) {",
      "        Queue<Integer> taskQueue = new ArrayDeque<>();",
      "        taskQueue.offer(10);",
      "        taskQueue.offer(20);",
      "        int front = taskQueue.peek();",
      "        int removed = taskQueue.poll();",
      "        System.out.println(\"Front: \" + front + \" Removed: \" + removed);",
      "    }",
      "}"
    ].join("\n")
  };

  const expectedValues = {
    javascript: ["B"],
    python: ["B"],
    java: [20]
  };

  const expectedFrontValues = {
    javascript: "A",
    python: "A",
    java: 10
  };

  const executions = {};

  for (const [language, source] of Object.entries(fixtures)) {
    const execution = assertCompletedProgram(
      await execute(baseUrl, language, source),
      language
    );

    assertRequiredEvents(execution.trace, [
      "QUEUE_CREATE",
      "QUEUE_ENQUEUE",
      "QUEUE_DEQUEUE",
      "QUEUE_PEEK"
    ]);

    const queueName = language === "python" ? "task_queue" : "taskQueue";
    const finalState = execution.states.at(-1);

    assert.deepEqual(finalState.queues[queueName], expectedValues[language]);
    assert.equal(finalState.variables.front, expectedFrontValues[language]);
    assert.equal(finalState.variables.removed, expectedFrontValues[language]);

    executions[language] = execution;
  }

  return executions;
}

async function testCrossLanguageLinkedLists(baseUrl) {
  const fixtures = {
    javascript: [
      "const linkedList = new LinkedList();",
      "linkedList.append(10);",
      "linkedList.append(30);",
      "linkedList.insert(1, 20);",
      "const visited = linkedList.get(1);",
      "const removed = linkedList.removeAt(0);",
      'console.log("Visited:", visited, "Removed:", removed);'
    ].join("\n"),
    python: [
      "linked_list = LinkedList()",
      "linked_list.append(10)",
      "linked_list.append(30)",
      "linked_list.insert(1, 20)",
      "visited = linked_list.get(1)",
      "removed = linked_list.remove_at(0)",
      'print("Visited:", visited, "Removed:", removed)'
    ].join("\n"),
    java: [
      "import java.util.LinkedList;",
      "",
      "public class Main {",
      "    public static void main(String[] args) {",
      "        LinkedList<Integer> linkedList = new LinkedList<>();",
      "        linkedList.add(10);",
      "        linkedList.add(30);",
      "        linkedList.add(1, 20);",
      "        int visited = linkedList.get(1);",
      "        int removed = linkedList.remove(0);",
      '        System.out.println("Visited: " + visited + " Removed: " + removed);',
      "    }",
      "}"
    ].join("\n")
  };
  const executions = {};

  for (const [language, source] of Object.entries(fixtures)) {
    const execution = assertCompletedProgram(
      await execute(baseUrl, language, source),
      language
    );

    assertRequiredEvents(execution.trace, [
      "LINKED_LIST_CREATE",
      "NODE_CREATE",
      "NODE_INSERT",
      "NODE_DELETE",
      "NODE_VISIT",
      "REFERENCE_UPDATE"
    ]);

    const name = language === "python" ? "linked_list" : "linkedList";
    const finalState = execution.states.at(-1);
    const nodes = finalState.linkedLists[name].nodes;

    assert.deepEqual(nodes.map((node) => node.value), [20, 30]);
    assert.equal(nodes[0].nextId, nodes[1].id);
    assert.equal(nodes[1].nextId, null);
    assert.equal(finalState.linkedLists[name].headId, nodes[0].id);
    assert.equal(finalState.linkedLists[name].tailId, nodes[1].id);
    assert.equal(finalState.variables.visited, 20);
    assert.equal(finalState.variables.removed, 10);

    executions[language] = execution;
  }

  return executions;
}

async function testCrossLanguageHashMaps(baseUrl) {
  const fixtures = {
    javascript: [
      "const scores = new Map();",
      'scores.set("Alice", 90);',
      'scores.set("Bob", 80);',
      'scores.set("Bob", 85);',
      'const selected = scores.get("Bob");',
      'const removed = scores.get("Alice");',
      'scores.delete("Alice");',
      'console.log("Selected:", selected, "Removed:", removed);'
    ].join("\n"),
    python: [
      "scores = {}",
      'scores["Alice"] = 90',
      'scores["Bob"] = 80',
      'scores["Bob"] = 85',
      'selected = scores.get("Bob")',
      'removed = scores.pop("Alice")',
      'print("Selected:", selected, "Removed:", removed)'
    ].join("\n"),
    java: [
      "import java.util.HashMap;",
      "import java.util.Map;",
      "",
      "public class Main {",
      "    public static void main(String[] args) {",
      "        Map<String, Integer> scores = new HashMap<>();",
      '        scores.put("Alice", 90);',
      '        scores.put("Bob", 80);',
      '        scores.put("Bob", 85);',
      '        int selected = scores.get("Bob");',
      '        int removed = scores.remove("Alice");',
      '        System.out.println("Selected: " + selected + " Removed: " + removed);',
      "    }",
      "}"
    ].join("\n")
  };
  const executions = {};

  for (const [language, source] of Object.entries(fixtures)) {
    const execution = assertCompletedProgram(
      await execute(baseUrl, language, source),
      language
    );

    assertRequiredEvents(execution.trace, [
      "HASHMAP_CREATE",
      "HASHMAP_SET",
      "HASHMAP_GET",
      "HASHMAP_DELETE"
    ]);

    const finalState = execution.states.at(-1);

    assert.deepEqual(finalState.hashMaps.scores.entries, [
      { key: "Bob", value: 85 }
    ]);
    assert.equal(finalState.hashMaps.scores.size, 1);
    assert.equal(finalState.variables.selected, 85);
    assert.equal(finalState.variables.removed, 90);
    assert.equal(
      execution.trace.events.some((event) => (
        event.type === "HASHMAP_SET" &&
        event.payload.key === "Bob" &&
        event.payload.updated === true &&
        event.payload.previousValue === 80
      )),
      true
    );

    executions[language] = execution;
  }

  return executions;
}

async function testCrossLanguageBinarySearchTrees(baseUrl) {
  const fixtures = {
    javascript: [
      "const tree = new BinarySearchTree();",
      "tree.insert(50);",
      "tree.insert(30);",
      "tree.insert(70);",
      "tree.insert(20);",
      "tree.insert(40);",
      "const found = tree.search(40);",
      "const traversal = tree.inorder();",
      'console.log("Found:", found, "Inorder:", traversal);'
    ].join("\n"),
    python: [
      "tree = BinarySearchTree()",
      "tree.insert(50)",
      "tree.insert(30)",
      "tree.insert(70)",
      "tree.insert(20)",
      "tree.insert(40)",
      "found = tree.search(40)",
      "traversal = tree.inorder()",
      'print("Found:", found, "Inorder:", traversal)'
    ].join("\n"),
    java: [
      "import java.util.TreeSet;",
      "",
      "public class Main {",
      "    public static void main(String[] args) {",
      "        TreeSet<Integer> tree = new TreeSet<>();",
      "        tree.add(50);",
      "        tree.add(30);",
      "        tree.add(70);",
      "        tree.add(20);",
      "        tree.add(40);",
      "        boolean found = tree.contains(40);",
      "        Object[] traversal = tree.toArray();",
      '        System.out.println("Found: " + found + " Inorder size: " + traversal.length);',
      "    }",
      "}"
    ].join("\n")
  };
  const executions = {};

  for (const [language, source] of Object.entries(fixtures)) {
    const execution = assertCompletedProgram(
      await execute(baseUrl, language, source),
      language
    );

    assertRequiredEvents(execution.trace, [
      "TREE_CREATE",
      "TREE_INSERT",
      "TREE_SEARCH",
      "TREE_TRAVERSE"
    ]);

    const finalState = execution.states.at(-1);
    const tree = finalState.trees.tree;

    assert.equal(tree.nodes.length, 5);
    assert.equal(tree.nodes.find((node) => node.id === tree.rootId).value, 50);
    assert.deepEqual(tree.traversalOrder, [20, 30, 40, 50, 70]);
    assert.equal(tree.searchResult, true);
    assert.equal(finalState.variables.found, true);
    assert.equal(
      execution.trace.events.filter((event) => event.type === "TREE_INSERT").length,
      5
    );

    executions[language] = execution;
  }

  return executions;
}

function assertCompletedQuery(response) {
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.language, "sql");
  assert.equal(response.body.executionStatus, "completed");

  const trace = response.body.trace;
  assertValidTrace(trace);

  assert.equal(trace.schemaVersion, "1.0.0");
  assert.equal(trace.domain, "query");
  assert.equal(trace.language, "sql");
  assert.equal(trace.events[0].type, "SQL_QUERY_START");
  assert.equal(trace.events.at(-1).type, "SQL_QUERY_END");
  assert.equal(response.body.states.length, trace.eventCount);
  assert.equal(response.body.summary.eventCount, trace.eventCount);
  assert.equal(response.body.security.dedicatedChildProcess, true);
  assert.equal(response.body.security.privateInMemoryDatabase, true);
  assert.equal(response.body.security.readOnlyQueries, true);

  return response.body;
}

async function testRealSqlExecution(baseUrl) {
  const response = await execute(baseUrl, "sql", createSqlFixture());
  const execution = assertCompletedQuery(response);

  assertRequiredEvents(execution.trace, [
    "SQL_SCAN",
    "SQL_FILTER",
    "SQL_PROJECT",
    "SQL_SORT",
    "SQL_LIMIT",
    "SQL_RESULT",
    "OUTPUT"
  ]);

  assert.equal(
    execution.trace.events.filter((event) => event.type === "SQL_FILTER").length,
    5
  );

  const finalState = execution.states.at(-1);

  assert.deepEqual(finalState.query.resultRows, [
    { name: "Divya", marks: 92 },
    { name: "Nila", marks: 88 },
    { name: "Kavin", marks: 84 }
  ]);

  assert.equal(finalState.query.scannedRowCount, 5);
  assert.equal(finalState.query.matchingRowCount, 3);
  assert.equal(finalState.query.rejectedRowCount, 2);
  assert.equal(finalState.console[0].text, "3 rows returned");
  assert.equal(execution.summary.rowCount, 3);

  return execution;
}

async function testSqlJoin(baseUrl) {
  const query = [
    "SELECT students.name, departments.department",
    "FROM students",
    "JOIN departments ON students.id = departments.student_id",
    "WHERE students.marks > 80",
    "ORDER BY students.marks DESC;"
  ].join("\n");

  const execution = assertCompletedQuery(await execute(baseUrl, "sql", query));

  assertRequiredEvents(execution.trace, ["SQL_SCAN", "SQL_JOIN", "SQL_FILTER"]);

  assert.deepEqual(execution.states.at(-1).query.resultRows, [
    { name: "Divya", department: "CSE" },
    { name: "Nila", department: "ECE" },
    { name: "Kavin", department: "CSE" }
  ]);
}

async function testSqlGroupingAndAggregation(baseUrl) {
  const query = [
    "SELECT department, COUNT(*) AS student_count",
    "FROM departments",
    "GROUP BY department",
    "ORDER BY student_count DESC;"
  ].join("\n");

  const execution = assertCompletedQuery(await execute(baseUrl, "sql", query));

  assertRequiredEvents(execution.trace, [
    "SQL_GROUP",
    "SQL_AGGREGATE",
    "SQL_PROJECT",
    "SQL_SORT"
  ]);

  assert.deepEqual(execution.states.at(-1).query.resultRows, [
    { department: "CSE", student_count: 3 },
    { department: "ECE", student_count: 2 }
  ]);
}

async function testSqlDistinct(baseUrl) {
  const query = "SELECT DISTINCT department FROM departments ORDER BY department;";
  const execution = assertCompletedQuery(await execute(baseUrl, "sql", query));

  assertRequiredEvents(execution.trace, ["SQL_DISTINCT", "SQL_SORT"]);

  assert.deepEqual(execution.states.at(-1).query.resultRows, [
    { department: "CSE" },
    { department: "ECE" }
  ]);
}

async function testSyntaxErrors(baseUrl) {
  for (const [language, source] of [
    ["javascript", "const = ;"],
    ["python", "def broken(:"],
    ["java", "public class Main { public static void main(String[] args) { int value = ; } }"],
    ["sql", "SELECT missing_column FROM students;"]
  ]) {
    const execution = await execute(baseUrl, language, source);

    assert.equal(execution.status, 200);
    assert.equal(execution.body.executionStatus, "failed");
    assert.equal(execution.body.trace.status, "failed");
    assert.equal(execution.body.states.at(-1).errors.length, 1);
  }
}

async function testPolicyRejection(baseUrl) {
  for (const [language, source] of [
    ["javascript", "process.exit(1);"],
    ["python", "import os\nprint(os.getcwd())"],
    ["java", "public class Main { public static void main(String[] args) { new ProcessBuilder(\"cmd\"); } }"],
    ["sql", "DROP TABLE students;"],
    ["sql", "SELECT name FROM students; DELETE FROM students;"]
  ]) {
    const execution = await execute(baseUrl, language, source);

    assert.equal(execution.status, 400);
    assert.equal(execution.body.error.code, "SOURCE_POLICY_VIOLATION");
  }
}

async function testRequestValidation(baseUrl) {
  const unsupportedLanguage = await execute(baseUrl, "c", "int main() {}");

  assert.equal(unsupportedLanguage.status, 400);
  assert.equal(unsupportedLanguage.body.error.code, "UNSUPPORTED_LANGUAGE");

  const missingSource = await execute(baseUrl, "javascript", "");

  assert.equal(missingSource.status, 400);
  assert.equal(missingSource.body.error.code, "INVALID_SOURCE");

  const missingRoute = await requestJson(baseUrl, "/missing");
  assert.equal(missingRoute.status, 404);
}

async function runTests() {
  const server = createExecutionServer();
  const address = await listen(server);
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await testHealth(baseUrl);
    await testLanguageCapabilities(baseUrl);

    const javascript = await testRealJavaScriptExecution(baseUrl);
    const python = await testRealPythonExecution(baseUrl);
    const java = await testRealJavaExecution(baseUrl);
    const sql = await testRealSqlExecution(baseUrl);
    const queues = await testCrossLanguageQueues(baseUrl);
    const linkedLists = await testCrossLanguageLinkedLists(baseUrl);
    const hashMaps = await testCrossLanguageHashMaps(baseUrl);
    const trees = await testCrossLanguageBinarySearchTrees(baseUrl);

    await testPythonEnumerate(baseUrl);
    await testSqlJoin(baseUrl);
    await testSqlGroupingAndAggregation(baseUrl);
    await testSqlDistinct(baseUrl);
    await testSyntaxErrors(baseUrl);
    await testPolicyRejection(baseUrl);
    await testRequestValidation(baseUrl);

    const finalPythonState = python.states.at(-1);

    console.log("Execution service tests passed.");
    console.log("Real JavaScript execution: passed");
    console.log(`JavaScript trace events: ${javascript.trace.eventCount}`);
    console.log("Real Python execution: passed");
    console.log(`Python trace events: ${python.trace.eventCount}`);
    console.log(`Python final numbers: ${JSON.stringify(finalPythonState.arrays.numbers)}`);
    console.log(`Python final stack: ${JSON.stringify(finalPythonState.stacks.stack)}`);
    console.log(`Python final total: ${finalPythonState.variables.total}`);
    console.log(`Python final loop index: ${finalPythonState.variables.index}`);
    console.log("Python enumerate support: passed");
    console.log("Real Java JDI execution: passed");
    console.log(`Java trace events: ${java.trace.eventCount}`);
    console.log(`Java final numbers: ${JSON.stringify(java.states.at(-1).arrays.numbers)}`);
    console.log(`Java final stack: ${JSON.stringify(java.states.at(-1).stacks.stack)}`);
    console.log(`Java final total: ${java.states.at(-1).variables.total}`);
    console.log("Real SQL SQLite execution: passed");
    console.log(`SQL trace events: ${sql.trace.eventCount}`);
    console.log(`SQL scanned rows: ${sql.summary.scannedRowCount}`);
    console.log(`SQL matching rows: ${sql.summary.matchingRowCount}`);
    console.log(`SQL rejected rows: ${sql.summary.rejectedRowCount}`);
    console.log(`SQL final rows: ${JSON.stringify(sql.states.at(-1).query.resultRows)}`);
    console.log("SQL JOIN visualization: passed");
    console.log("SQL GROUP BY and aggregation: passed");
    console.log("SQL DISTINCT visualization: passed");
    console.log("Cross-language queue execution: passed");
    console.log("Queue front and removed variables: passed");
    console.log(`JavaScript queue events: ${queues.javascript.trace.events.filter((event) => event.type.startsWith("QUEUE_")).length}`);
    console.log(`Python queue events: ${queues.python.trace.events.filter((event) => event.type.startsWith("QUEUE_")).length}`);
    console.log(`Java queue events: ${queues.java.trace.events.filter((event) => event.type.startsWith("QUEUE_")).length}`);
    console.log("Cross-language linked-list execution: passed");
    console.log("Linked-list insertion, deletion, traversal, and references: passed");
    console.log(`JavaScript linked-list events: ${linkedLists.javascript.trace.events.filter((event) => /LINKED_LIST|NODE_|REFERENCE_/.test(event.type)).length}`);
    console.log(`Python linked-list events: ${linkedLists.python.trace.events.filter((event) => /LINKED_LIST|NODE_|REFERENCE_/.test(event.type)).length}`);
    console.log(`Java linked-list events: ${linkedLists.java.trace.events.filter((event) => /LINKED_LIST|NODE_|REFERENCE_/.test(event.type)).length}`);
    console.log("Cross-language HashMap execution: passed");
    console.log("HashMap insertion, update, lookup, and deletion: passed");
    console.log(`JavaScript HashMap events: ${hashMaps.javascript.trace.events.filter((event) => event.type.startsWith("HASHMAP_")).length}`);
    console.log(`Python HashMap events: ${hashMaps.python.trace.events.filter((event) => event.type.startsWith("HASHMAP_")).length}`);
    console.log(`Java HashMap events: ${hashMaps.java.trace.events.filter((event) => event.type.startsWith("HASHMAP_")).length}`);
    console.log("Cross-language Binary Search Tree execution: passed");
    console.log("BST insertion, search path, and inorder traversal: passed");
    console.log(`JavaScript tree events: ${trees.javascript.trace.events.filter((event) => event.type.startsWith("TREE_")).length}`);
    console.log(`Python tree events: ${trees.python.trace.events.filter((event) => event.type.startsWith("TREE_")).length}`);
    console.log(`Java tree events: ${trees.java.trace.events.filter((event) => event.type.startsWith("TREE_")).length}`);
    console.log("Shared execution trace compatibility: passed");
    console.log("Syntax error handling: passed");
    console.log("Restricted source rejection: passed");
    console.log("Existing language boundaries: passed");
  } finally {
    await close(server);
  }
}

runTests().catch((error) => {
  console.error("Execution service tests failed.");
  console.error(error);
  process.exitCode = 1;
});
