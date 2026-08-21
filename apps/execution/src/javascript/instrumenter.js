"use strict";

const parser = require("@babel/parser");

const traverseModule =
  require("@babel/traverse");

const generatorModule =
  require("@babel/generator");

const t = require("@babel/types");

const traverse =
  traverseModule.default ?? traverseModule;

const generate =
  generatorModule.default ?? generatorModule;

function markGenerated(node) {
  node.__codeflowGenerated = true;
  return node;
}

function isGenerated(path) {
  return Boolean(
    path.node.__codeflowGenerated
  );
}

function getLine(node) {
  return node.loc?.start?.line ?? 1;
}

function getOriginalSource(node, sourceCode) {
  if (
    Number.isInteger(node.start) &&
    Number.isInteger(node.end)
  ) {
    return sourceCode
      .slice(node.start, node.end)
      .trim();
  }

  return "";
}

function runtimeCall(methodName, argumentsList) {
  const call = t.callExpression(
    t.memberExpression(
      t.identifier("__trace"),
      t.identifier(methodName)
    ),
    argumentsList
  );

  return markGenerated(call);
}

function runtimeStatement(
  methodName,
  argumentsList
) {
  const statement = t.expressionStatement(
    runtimeCall(methodName, argumentsList)
  );

  return markGenerated(statement);
}

function functionNameFromPath(path) {
  const functionParent =
    path.getFunctionParent();

  if (!functionParent) {
    return "<anonymous>";
  }

  if (
    functionParent.isFunctionDeclaration() &&
    functionParent.node.id
  ) {
    return functionParent.node.id.name;
  }

  if (
    functionParent.isFunctionExpression() &&
    functionParent.node.id
  ) {
    return functionParent.node.id.name;
  }

  const parent = functionParent.parentPath;

  if (
    parent?.isVariableDeclarator() &&
    t.isIdentifier(parent.node.id)
  ) {
    return parent.node.id.name;
  }

  return "<anonymous>";
}

function calleeName(callee) {
  if (t.isIdentifier(callee)) {
    return callee.name;
  }

  if (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object) &&
    t.isIdentifier(callee.property)
  ) {
    return (
      `${callee.object.name}.` +
      `${callee.property.name}`
    );
  }

  return "<call>";
}

function isRuntimeCall(node) {
  return (
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(
      node.callee.object,
      {
        name: "__trace",
      }
    )
  );
}

function isConsoleLog(node) {
  return (
    t.isMemberExpression(node.callee) &&
    !node.callee.computed &&
    t.isIdentifier(
      node.callee.object,
      {
        name: "console",
      }
    ) &&
    t.isIdentifier(
      node.callee.property,
      {
        name: "log",
      }
    )
  );
}

function createParameterObject(parameters) {
  const properties = [];

  for (const parameter of parameters) {
    if (t.isIdentifier(parameter)) {
      properties.push(
        t.objectProperty(
          t.identifier(parameter.name),
          t.identifier(parameter.name),
          false,
          true
        )
      );
    }
  }

  return t.objectExpression(properties);
}

function ensureBlock(statement) {
  if (t.isBlockStatement(statement)) {
    return statement;
  }

  return t.blockStatement([statement]);
}

function instrumentSource(sourceCode) {
  if (
    typeof sourceCode !== "string" ||
    sourceCode.trim() === ""
  ) {
    throw new TypeError(
      "sourceCode must be a non-empty string."
    );
  }

  const ast = parser.parse(sourceCode, {
    sourceType: "script",
    allowReturnOutsideFunction: false,
    errorRecovery: false,
    ranges: true,
  });

  traverse(ast, {
    Statement(path) {
      if (isGenerated(path)) {
        return;
      }

      if (
        path.parentPath.isProgram() ||
        path.parentPath.isBlockStatement()
      ) {
        path.insertBefore(
          runtimeStatement("statement", [
            t.numericLiteral(
              getLine(path.node)
            ),
          ])
        );
      }
    },

    FunctionDeclaration: {
      enter(path) {
        if (isGenerated(path)) {
          return;
        }

        const functionName =
          path.node.id?.name ?? "<anonymous>";

        const enterStatement =
          runtimeStatement(
            "functionEnter",
            [
              t.stringLiteral(functionName),
              createParameterObject(
                path.node.params
              ),
              t.numericLiteral(
                getLine(path.node)
              ),
            ]
          );

        path.node.body.body.unshift(
          enterStatement
        );
      },
    },

    ReturnStatement: {
      exit(path) {
        if (isGenerated(path)) {
          return;
        }

        const functionName =
          functionNameFromPath(path);

        const returnExpression =
          path.node.argument ??
          t.identifier("undefined");

        path.node.argument = runtimeCall(
          "functionReturn",
          [
            t.stringLiteral(functionName),
            returnExpression,
            t.numericLiteral(
              getLine(path.node)
            ),
          ]
        );
      },
    },

    VariableDeclarator: {
      exit(path) {
        if (
          isGenerated(path) ||
          !t.isIdentifier(path.node.id) ||
          path.node.init === null
        ) {
          return;
        }

        if (
          t.isCallExpression(path.node.init) &&
          isRuntimeCall(path.node.init) &&
          t.isIdentifier(
            path.node.init.callee.property,
            {
              name: "declare"
            }
          )
        ) {
          return;
        }

        path.node.init = runtimeCall(
          "declare",
          [
            t.stringLiteral(
              path.node.id.name
            ),
            path.node.init,
            t.numericLiteral(
              getLine(path.node)
            ),
          ]
        );
      },
    },

    AssignmentExpression: {
      exit(path) {
        if (isGenerated(path)) {
          return;
        }

        const line = getLine(path.node);
        const assignmentOperator =
          path.node.operator;

        const originalAssignment =
          t.cloneNode(path.node, true);

        if (t.isIdentifier(path.node.left)) {
          const variableName =
            path.node.left.name;

          const replacement = runtimeCall(
            "captureAssignment",
            [
              t.stringLiteral(variableName),
              t.arrowFunctionExpression(
                [],
                t.identifier(variableName)
              ),
              t.arrowFunctionExpression(
                [],
                originalAssignment
              ),
              t.numericLiteral(line),
              t.stringLiteral(
                assignmentOperator
              ),
            ]
          );

          path.replaceWith(replacement);
          path.skip();
          return;
        }

        if (
          t.isMemberExpression(
            path.node.left
          ) &&
          path.node.left.computed &&
          t.isIdentifier(
            path.node.left.object
          )
        ) {
          const arrayName =
            path.node.left.object.name;

          const replacement = runtimeCall(
            "captureArrayAssignment",
            [
              t.stringLiteral(arrayName),
              t.identifier(arrayName),
              t.cloneNode(
                path.node.left.property,
                true
              ),
              t.arrowFunctionExpression(
                [],
                originalAssignment
              ),
              t.numericLiteral(line),
              t.stringLiteral(
                assignmentOperator
              ),
            ]
          );

          path.replaceWith(replacement);
          path.skip();
        }
      },
    },

    MemberExpression: {
      exit(path) {
        if (
          isGenerated(path) ||
          !path.node.computed ||
          !t.isIdentifier(path.node.object)
        ) {
          return;
        }

        if (
          path.parentPath.isAssignmentExpression() &&
          path.parentKey === "left"
        ) {
          return;
        }

        const arrayName =
          path.node.object.name;

        const replacement = runtimeCall(
          "arrayAccess",
          [
            t.stringLiteral(arrayName),
            t.identifier(arrayName),
            t.cloneNode(
              path.node.property,
              true
            ),
            t.numericLiteral(
              getLine(path.node)
            ),
          ]
        );

        path.replaceWith(replacement);
        path.skip();
      },
    },

    CallExpression: {
      exit(path) {
        if (
          isGenerated(path) ||
          isRuntimeCall(path.node)
        ) {
          return;
        }

        const line = getLine(path.node);

        if (isConsoleLog(path.node)) {
          const replacement = runtimeCall(
            "output",
            [
              t.numericLiteral(line),
              ...path.node.arguments,
            ]
          );

          path.replaceWith(replacement);
          path.skip();
          return;
        }

        const functionName =
          calleeName(path.node.callee);

        const originalCall =
          t.cloneNode(path.node, true);

        const replacement = runtimeCall(
          "call",
          [
            t.stringLiteral(functionName),
            t.numericLiteral(line),
            t.arrowFunctionExpression(
              [],
              originalCall
            ),
          ]
        );

        path.replaceWith(replacement);
        path.skip();
      },
    },

    IfStatement: {
      enter(path) {
        path.setData(
          "codeflowConditionSource",
          getOriginalSource(
            path.node.test,
            sourceCode
          )
        );
      },

      exit(path) {
        if (isGenerated(path)) {
          return;
        }

        const line = getLine(path.node);

        path.node.test = runtimeCall(
          "condition",
          [
            t.numericLiteral(line),
            t.stringLiteral(
              path.getData(
                "codeflowConditionSource"
              ) || "if condition"
            ),
            path.node.test,
          ]
        );

        const consequent = ensureBlock(
          path.node.consequent
        );

        consequent.body.unshift(
          runtimeStatement(
            "branchEnter",
            [
              t.numericLiteral(line),
              t.stringLiteral("if"),
            ]
          )
        );

        path.node.consequent = consequent;

        if (path.node.alternate) {
          const alternate = ensureBlock(
            path.node.alternate
          );

          alternate.body.unshift(
            runtimeStatement(
              "branchEnter",
              [
                t.numericLiteral(line),
                t.stringLiteral("else"),
              ]
            )
          );

          path.node.alternate = alternate;
        }
      },
    },

    ForStatement: {
      enter(path) {
        path.setData(
          "codeflowLoopConditionSource",
          path.node.test
            ? getOriginalSource(
                path.node.test,
                sourceCode
              )
            : "true"
        );
      },

      exit(path) {
        if (isGenerated(path)) {
          return;
        }

        const line = getLine(path.node);

        const originalTest =
          path.node.test ??
          t.booleanLiteral(true);

        path.node.test = runtimeCall(
          "loopCondition",
          [
            t.numericLiteral(line),
            t.stringLiteral(
              path.getData(
                "codeflowLoopConditionSource"
              ) || "true"
            ),
            originalTest,
          ]
        );

        const body = ensureBlock(
          path.node.body
        );

        body.body.unshift(
          runtimeStatement(
            "loopIteration",
            [t.numericLiteral(line)]
          )
        );

        path.node.body = body;

        path.insertBefore(
          runtimeStatement(
            "loopStart",
            [
              t.numericLiteral(line),
              t.stringLiteral("for"),
            ]
          )
        );

        path.insertAfter(
          runtimeStatement(
            "loopEnd",
            [t.numericLiteral(line)]
          )
        );
      },
    },
  });

  return generate(
    ast,
    {
      comments: true,
      compact: false,
      retainLines: true,
    },
    sourceCode
  ).code;
}

module.exports = {
  instrumentSource,
};
