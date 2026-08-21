"use strict";

const parser = require("@babel/parser");

const traverseModule = require("@babel/traverse");

const generatorModule = require("@babel/generator");

const t = require("@babel/types");

const traverse = (
  traverseModule.default ??
  traverseModule
);

const generate = (
  generatorModule.default ??
  generatorModule
);

const FORBIDDEN_IDENTIFIERS = new Set([
  "__trace",

  "process",

  "require",

  "module",

  "exports",

  "global",

  "globalThis",

  "eval",

  "Function",

  "fetch",

  "WebAssembly",

  "Deno",

  "Bun"
]);

const FORBIDDEN_PROPERTIES = new Set([
  "constructor",

  "prototype",

  "__proto__"
]);

class SourcePolicyError extends Error {
  constructor(message, line = null) {
    super(message);

    this.name = "SourcePolicyError";

    this.code = "SOURCE_POLICY_VIOLATION";

    this.line = line;
  }
}

function getLine(node) {
  return (
    node?.loc?.start?.line ??
    null
  );
}

function rejectNode(
  path,

  message
) {
  throw new SourcePolicyError(
    message,

    getLine(
      path.node
    )
  );
}

function getMemberPropertyName(node) {
  if (
    !node.computed &&
    t.isIdentifier(node.property)
  ) {
    return node.property.name;
  }

  if (
    node.computed &&
    t.isStringLiteral(node.property)
  ) {
    return node.property.value;
  }

  return null;
}

function parseSource(sourceCode) {
  return parser.parse(
    sourceCode,

    {
      sourceType: "script",

      allowReturnOutsideFunction: false,

      errorRecovery: false,

      ranges: true
    }
  );
}

function validateSourcePolicy(ast) {
  traverse(
    ast,

    {
      Identifier(path) {
        if (
          !path.isReferencedIdentifier()
        ) {
          return;
        }

        if (
          FORBIDDEN_IDENTIFIERS.has(
            path.node.name
          )
        ) {
          rejectNode(
            path,

            `Access to "${path.node.name}" is not permitted in the local execution preview.`
          );
        }
      },

      MemberExpression(path) {
        const propertyName = getMemberPropertyName(
          path.node
        );

        if (
          propertyName !== null &&
          FORBIDDEN_PROPERTIES.has(
            propertyName
          )
        ) {
          rejectNode(
            path,

            `Access to property "${propertyName}" is not permitted.`
          );
        }
      },

      ImportDeclaration(path) {
        rejectNode(
          path,

          "Import statements are not supported in the current execution preview."
        );
      },

      ExportNamedDeclaration(path) {
        rejectNode(
          path,

          "Export statements are not supported in the current execution preview."
        );
      },

      ExportDefaultDeclaration(path) {
        rejectNode(
          path,

          "Export statements are not supported in the current execution preview."
        );
      },

      AwaitExpression(path) {
        rejectNode(
          path,

          "Asynchronous JavaScript is not supported in the current execution preview."
        );
      },

      YieldExpression(path) {
        rejectNode(
          path,

          "Generator execution is not supported in the current execution preview."
        );
      },

      WithStatement(path) {
        rejectNode(
          path,

          "The with statement is not supported."
        );
      },

      WhileStatement(path) {
        rejectNode(
          path,

          "while loops are not supported yet. Use a standard for loop."
        );
      },

      DoWhileStatement(path) {
        rejectNode(
          path,

          "do-while loops are not supported yet. Use a standard for loop."
        );
      },

      ForInStatement(path) {
        rejectNode(
          path,

          "for-in loops are not supported yet. Use a standard for loop."
        );
      },

      ForOfStatement(path) {
        rejectNode(
          path,

          "for-of loops are not supported yet. Use a standard for loop."
        );
      },

      ArrowFunctionExpression(path) {
        rejectNode(
          path,

          "Arrow functions are not supported yet. Use a function declaration."
        );
      },

      FunctionExpression(path) {
        rejectNode(
          path,

          "Function expressions are not supported yet. Use a function declaration."
        );
      },

      Function(path) {
        if (path.node.async) {
          rejectNode(
            path,

            "Async functions are not supported in the current execution preview."
          );
        }

        if (path.node.generator) {
          rejectNode(
            path,

            "Generator functions are not supported in the current execution preview."
          );
        }
      },

      NewExpression(path) {
        if (
          t.isIdentifier(path.node.callee, { name: "LinkedList" }) &&
          path.node.arguments.length === 0
        ) {
          return;
        }

        rejectNode(
          path,

          "Constructor calls are not supported in the current execution preview."
        );
      },

      CallExpression(path) {
        const callee = path.node.callee;

        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(
            callee.object,

            {
              name: "console"
            }
          )
        ) {
          const methodName = getMemberPropertyName(
            callee
          );

          if (methodName !== "log") {
            rejectNode(
              path,

              "Only console.log() is supported in the current execution preview."
            );
          }
        }
      }
    }
  );
}

function canNormalizeUpdateExpression(path) {
  if (
    !t.isIdentifier(
      path.node.argument
    )
  ) {
    return false;
  }

  if (
    path.parentPath.isExpressionStatement()
  ) {
    return true;
  }

  if (
    path.parentPath.isForStatement() &&
    path.key === "update"
  ) {
    return true;
  }

  return false;
}

function normalizeUpdateExpressions(ast) {
  let changed = false;

  traverse(
    ast,

    {
      UpdateExpression(path) {
        if (
          !canNormalizeUpdateExpression(path)
        ) {
          return;
        }

        const operator = path.node.operator;

        if (
          operator !== "++" &&
          operator !== "--"
        ) {
          return;
        }

        const originalNode = path.node;

        const replacement = t.assignmentExpression(
          operator === "++"
            ? "+="
            : "-=",

          t.identifier(
            originalNode.argument.name
          ),

          t.numericLiteral(1)
        );

        replacement.loc = originalNode.loc;

        replacement.start = originalNode.start;

        replacement.end = originalNode.end;

        path.replaceWith(
          replacement
        );

        changed = true;
      }
    }
  );

  return changed;
}

function prepareSourceForInstrumentation(sourceCode) {
  if (
    typeof sourceCode !== "string" ||
    sourceCode.trim().length === 0
  ) {
    throw new TypeError(
      "sourceCode must be a non-empty string."
    );
  }

  const ast = parseSource(
    sourceCode
  );

  validateSourcePolicy(
    ast
  );

  const sourceChanged = normalizeUpdateExpressions(
    ast
  );

  if (!sourceChanged) {
    return sourceCode;
  }

  return generate(
    ast,

    {
      comments: true,

      compact: false,

      retainLines: true
    },

    sourceCode
  ).code;
}

module.exports = {
  SourcePolicyError,

  prepareSourceForInstrumentation
};
