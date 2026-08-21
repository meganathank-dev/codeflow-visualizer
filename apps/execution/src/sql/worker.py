"""Run restricted educational SQL queries against a private in-memory database.

The emitted operations describe a logical teaching model. They do not claim to
reproduce SQLite's physical optimizer or its internal execution plan.
"""

import json
import re
import sqlite3
import sys


MAXIMUM_INPUT_BYTES = 64 * 1024
DEFAULT_MAXIMUM_ROWS = 100
MAXIMUM_SQLITE_PROGRESS_CALLBACKS = 1_000

ALLOWED_TABLES = {"students", "departments"}
ALLOWED_FUNCTIONS = {
    "avg",
    "coalesce",
    "count",
    "length",
    "lower",
    "max",
    "min",
    "round",
    "sum",
    "upper",
}

FORBIDDEN_STATEMENT_KEYWORDS = {
    "ALTER",
    "ANALYZE",
    "ATTACH",
    "BEGIN",
    "COMMIT",
    "CREATE",
    "DELETE",
    "DETACH",
    "DROP",
    "EXPLAIN",
    "INSERT",
    "PRAGMA",
    "REINDEX",
    "RELEASE",
    "REPLACE",
    "ROLLBACK",
    "SAVEPOINT",
    "UPDATE",
    "VACUUM",
    "WITH",
}

CLAUSE_PATTERN = re.compile(
    r"\b(FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|"
    r"UNION|INTERSECT|EXCEPT)\b",
    re.IGNORECASE,
)

AGGREGATE_PATTERN = re.compile(
    r"\b(COUNT|SUM|AVG|MIN|MAX)\s*\(",
    re.IGNORECASE,
)


class SourcePolicyError(Exception):
    pass


class QueryShapeError(Exception):
    pass


class TraceLimitError(Exception):
    pass


def write_response(payload):
    json.dump(payload, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stdout.flush()


def scan_source(source):
    """Keep top-level SQL visible while masking strings and nested expressions."""

    characters = list(source)
    mask = list(source)
    quote = None
    depth = 0
    semicolons = []
    index = 0

    while index < len(characters):
        current = characters[index]
        following = characters[index + 1] if index + 1 < len(characters) else ""

        if quote is not None:
            if current != "\n":
                mask[index] = " "

            if current == quote:
                if following == quote:
                    if following != "\n":
                        mask[index + 1] = " "

                    index += 2
                    continue

                quote = None

            index += 1
            continue

        if current == "-" and following == "-":
            raise SourcePolicyError("SQL comments are not supported in the query workspace.")

        if current == "/" and following == "*":
            raise SourcePolicyError("SQL comments are not supported in the query workspace.")

        if current in {"'", '"', "`"}:
            quote = current
            mask[index] = " "
            index += 1
            continue

        if current == "(":
            depth += 1
            mask[index] = " "
            index += 1
            continue

        if current == ")":
            if depth == 0:
                raise QueryShapeError("SQL query contains an unmatched closing parenthesis.")

            depth -= 1
            mask[index] = " "
            index += 1
            continue

        if current == ";" and depth == 0:
            semicolons.append(index)

        if depth > 0 and current != "\n":
            mask[index] = " "

        index += 1

    if quote is not None:
        raise QueryShapeError("SQL query contains an unterminated quoted value.")

    if depth != 0:
        raise QueryShapeError("SQL query contains an unmatched opening parenthesis.")

    return "".join(mask), semicolons


def normalize_keyword(keyword):
    return re.sub(r"\s+", " ", keyword).upper()


def line_at(source, offset):
    return source.count("\n", 0, max(0, offset)) + 1


def inspect_query(source):
    if not isinstance(source, str) or not source.strip():
        raise QueryShapeError("SQL source must contain a SELECT query.")

    masked_source, semicolons = scan_source(source)

    if len(semicolons) > 1:
        raise SourcePolicyError("Only one SQL SELECT statement is permitted.")

    if semicolons:
        semicolon = semicolons[0]

        if source[semicolon + 1 :].strip():
            raise SourcePolicyError("Only one SQL SELECT statement is permitted.")

        source = source[:semicolon]
        masked_source = masked_source[:semicolon]

    first_keyword = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)", masked_source)

    if first_keyword is None:
        raise QueryShapeError("SQL query must begin with SELECT.")

    keyword = first_keyword.group(1).upper()

    if keyword in FORBIDDEN_STATEMENT_KEYWORDS:
        raise SourcePolicyError(
            f"{keyword} statements are not permitted; only read-only SELECT is supported."
        )

    if keyword != "SELECT":
        raise QueryShapeError("SQL query must begin with SELECT.")

    clauses = []

    for match in CLAUSE_PATTERN.finditer(masked_source, first_keyword.end()):
        name = normalize_keyword(match.group(1))

        if name in {"UNION", "INTERSECT", "EXCEPT"}:
            raise QueryShapeError(f"{name} queries are not supported in the current SQL phase.")

        clauses.append((name, match.start(), match.end()))

    if not clauses or clauses[0][0] != "FROM":
        raise QueryShapeError("Educational SQL queries must include a FROM clause.")

    order = {
        "FROM": 0,
        "WHERE": 1,
        "GROUP BY": 2,
        "HAVING": 3,
        "ORDER BY": 4,
        "LIMIT": 5,
        "OFFSET": 6,
    }
    seen = set()
    previous_order = -1
    sections = {}
    lines = {"SELECT": line_at(source, first_keyword.start())}

    select_text = source[first_keyword.end() : clauses[0][1]].strip()

    if not select_text:
        raise QueryShapeError("SELECT must specify at least one expression or column.")

    distinct = bool(re.match(r"^DISTINCT\b", select_text, re.IGNORECASE))

    if distinct:
        select_text = re.sub(r"^DISTINCT\s+", "", select_text, count=1, flags=re.IGNORECASE)

    if not select_text.strip():
        raise QueryShapeError("SELECT DISTINCT must specify at least one column.")

    for index, (name, start, end) in enumerate(clauses):
        if name in seen or order[name] <= previous_order:
            raise QueryShapeError(f"SQL clause {name} is duplicated or out of order.")

        next_start = clauses[index + 1][1] if index + 1 < len(clauses) else len(source)
        body = source[end:next_start].strip()

        if not body:
            raise QueryShapeError(f"SQL clause {name} requires an expression.")

        sections[name] = body
        lines[name] = line_at(source, start)
        seen.add(name)
        previous_order = order[name]

    if "OFFSET" in sections and "LIMIT" not in sections:
        raise QueryShapeError("OFFSET requires LIMIT in this SQL workspace.")

    table_match = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\b", sections["FROM"])

    if table_match is None:
        raise QueryShapeError("FROM must start with a supported table name.")

    primary_table = table_match.group(1)

    if primary_table.lower() not in ALLOWED_TABLES:
        raise QueryShapeError(f'Unknown teaching table "{primary_table}".')

    joined_tables = re.findall(
        r"\bJOIN\s+([A-Za-z_][A-Za-z0-9_]*)\b",
        sections["FROM"],
        re.IGNORECASE,
    )

    for table in joined_tables:
        if table.lower() not in ALLOWED_TABLES:
            raise QueryShapeError(f'Unknown teaching table "{table}".')

    return {
        "source": source.strip(),
        "masked": masked_source,
        "select": select_text.strip(),
        "distinct": distinct,
        "sections": sections,
        "lines": lines,
        "table": primary_table,
        "joinedTables": joined_tables,
        "aggregate": bool(
            AGGREGATE_PATTERN.search(select_text)
            or AGGREGATE_PATTERN.search(sections.get("HAVING", ""))
        ),
    }


def create_database():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row

    connection.executescript(
        """
        CREATE TABLE students (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            marks INTEGER NOT NULL
        );

        CREATE TABLE departments (
            student_id INTEGER PRIMARY KEY,
            department TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(id)
        );
        """
    )

    connection.executemany(
        "INSERT INTO students (id, name, marks) VALUES (?, ?, ?)",
        [
            (1, "Arun", 72),
            (2, "Divya", 92),
            (3, "Nila", 88),
            (4, "Kavin", 84),
            (5, "Manoj", 65),
        ],
    )

    connection.executemany(
        "INSERT INTO departments (student_id, department) VALUES (?, ?)",
        [
            (1, "CSE"),
            (2, "CSE"),
            (3, "ECE"),
            (4, "CSE"),
            (5, "ECE"),
        ],
    )

    connection.commit()
    connection.execute("PRAGMA query_only = ON")

    callback_count = {"value": 0}

    def limit_progress():
        callback_count["value"] += 1
        return int(callback_count["value"] > MAXIMUM_SQLITE_PROGRESS_CALLBACKS)

    def authorize(action, argument_one, argument_two, database, source):
        if action == sqlite3.SQLITE_SELECT:
            return sqlite3.SQLITE_OK

        if action == sqlite3.SQLITE_READ:
            return (
                sqlite3.SQLITE_OK
                if str(argument_one or "").lower() in ALLOWED_TABLES
                else sqlite3.SQLITE_DENY
            )

        if action == sqlite3.SQLITE_FUNCTION:
            function_name = str(argument_two or argument_one or "").lower()
            return (
                sqlite3.SQLITE_OK
                if function_name in ALLOWED_FUNCTIONS
                else sqlite3.SQLITE_DENY
            )

        return sqlite3.SQLITE_DENY

    connection.set_progress_handler(limit_progress, 1_000)
    connection.set_authorizer(authorize)
    return connection


def execute_rows(connection, query, maximum_rows):
    cursor = connection.execute(query)
    columns = [description[0] for description in cursor.description or []]
    fetched = cursor.fetchmany(maximum_rows + 1)

    if len(fetched) > maximum_rows:
        raise QueryShapeError(f"SQL query exceeded the maximum of {maximum_rows} result rows.")

    return columns, [dict(zip(columns, tuple(row))) for row in fetched]


def build_query(plan, include_distinct=False, include_having=True, include_order=False, include_limit=False):
    sections = plan["sections"]
    distinct = "DISTINCT " if include_distinct and plan["distinct"] else ""

    parts = [f"SELECT {distinct}{plan['select']}", f"FROM {sections['FROM']}"]

    for clause in ("WHERE", "GROUP BY"):
        if clause in sections:
            parts.append(f"{clause} {sections[clause]}")

    if include_having and "HAVING" in sections:
        parts.append(f"HAVING {sections['HAVING']}")

    if include_order and "ORDER BY" in sections:
        parts.append(f"ORDER BY {sections['ORDER BY']}")

    if include_limit and "LIMIT" in sections:
        parts.append(f"LIMIT {sections['LIMIT']}")

        if "OFFSET" in sections:
            parts.append(f"OFFSET {sections['OFFSET']}")

    return " ".join(parts)


def execute_logical_query(source, maximum_trace_events, maximum_rows):
    plan = inspect_query(source)
    sections = plan["sections"]
    lines = plan["lines"]
    events = []

    def record(event_type, line, payload):
        if len(events) + 2 >= maximum_trace_events:
            raise TraceLimitError("SQL visualization exceeded its maximum trace-event count.")

        events.append({"type": event_type, "line": max(1, int(line)), "payload": payload})

    with create_database() as connection:
        final_columns, final_rows = execute_rows(connection, plan["source"], maximum_rows)

        scan_columns, scanned_rows = execute_rows(
            connection,
            f'SELECT * FROM "{plan["table"]}"',
            maximum_rows,
        )

        record(
            "SQL_SCAN",
            lines["FROM"],
            {
                "table": plan["table"],
                "columns": scan_columns,
                "rows": scanned_rows,
                "rowCount": len(scanned_rows),
                "scannedRows": len(scanned_rows),
                "operation": f'Scan {plan["table"]}',
            },
        )

        source_columns, source_rows = execute_rows(
            connection,
            f"SELECT * FROM {sections['FROM']}",
            maximum_rows,
        )

        if plan["joinedTables"]:
            record(
                "SQL_JOIN",
                lines["FROM"],
                {
                    "table": plan["table"],
                    "tables": [plan["table"], *plan["joinedTables"]],
                    "join": sections["FROM"],
                    "columns": source_columns,
                    "rows": source_rows,
                    "rowCount": len(source_rows),
                    "operation": f'Join {", ".join(plan["joinedTables"])}',
                },
            )

        filtered_rows = source_rows

        if "WHERE" in sections:
            evaluation_columns, evaluation_rows = execute_rows(
                connection,
                (
                    f"SELECT *, CASE WHEN ({sections['WHERE']}) "
                    f"THEN 1 ELSE 0 END AS __codeflow_match FROM {sections['FROM']}"
                ),
                maximum_rows,
            )

            filtered_rows = []
            rejected_ids = []
            evaluated_rows = []

            for row in evaluation_rows:
                visible_row = {
                    column: row[column]
                    for column in evaluation_columns
                    if column != "__codeflow_match"
                }
                matched = bool(row["__codeflow_match"])
                evaluated_rows.append(visible_row)

                if matched:
                    filtered_rows.append(visible_row)
                elif "id" in visible_row:
                    rejected_ids.append(visible_row["id"])

                record(
                    "SQL_FILTER",
                    lines["WHERE"],
                    {
                        "table": plan["table"],
                        "condition": sections["WHERE"],
                        "predicate": sections["WHERE"],
                        "row": visible_row,
                        "rowIndex": len(evaluated_rows) - 1,
                        "result": matched,
                        "rows": list(filtered_rows),
                        "displayRows": source_rows,
                        "evaluatedRows": list(evaluated_rows),
                        "matchingRows": len(filtered_rows),
                        "rejectedRows": len(evaluated_rows) - len(filtered_rows),
                        "rejectedIds": list(rejected_ids),
                        "columns": source_columns,
                        "operation": f"WHERE {sections['WHERE']}",
                    },
                )

        if "GROUP BY" in sections:
            group_query = (
                f"SELECT {sections['GROUP BY']}, COUNT(*) AS __codeflow_group_size "
                f"FROM {sections['FROM']}"
            )

            if "WHERE" in sections:
                group_query += f" WHERE {sections['WHERE']}"

            group_query += f" GROUP BY {sections['GROUP BY']}"
            group_columns, group_rows = execute_rows(connection, group_query, maximum_rows)

            record(
                "SQL_GROUP",
                lines["GROUP BY"],
                {
                    "table": plan["table"],
                    "expression": sections["GROUP BY"],
                    "columns": group_columns,
                    "rows": group_rows,
                    "groupCount": len(group_rows),
                    "operation": f"GROUP BY {sections['GROUP BY']}",
                },
            )

        projected_columns, projected_rows = execute_rows(
            connection,
            build_query(plan),
            maximum_rows,
        )

        if plan["aggregate"]:
            record(
                "SQL_AGGREGATE",
                lines.get("GROUP BY", lines["SELECT"]),
                {
                    "table": plan["table"],
                    "expressions": plan["select"],
                    "columns": projected_columns,
                    "rows": projected_rows,
                    "rowCount": len(projected_rows),
                    "operation": "Calculate aggregate values",
                },
            )

        if "HAVING" in sections:
            record(
                "SQL_FILTER",
                lines["HAVING"],
                {
                    "table": plan["table"],
                    "condition": sections["HAVING"],
                    "predicate": sections["HAVING"],
                    "rows": projected_rows,
                    "matchingRows": len(projected_rows),
                    "rejectedRows": 0,
                    "columns": projected_columns,
                    "operation": f"HAVING {sections['HAVING']}",
                },
            )

        record(
            "SQL_PROJECT",
            lines["SELECT"],
            {
                "table": plan["table"],
                "expressions": plan["select"],
                "columns": projected_columns,
                "rows": projected_rows,
                "rowCount": len(projected_rows),
                "operation": f"SELECT {plan['select']}",
            },
        )

        current_rows = projected_rows

        if plan["distinct"]:
            distinct_columns, distinct_rows = execute_rows(
                connection,
                build_query(plan, include_distinct=True),
                maximum_rows,
            )

            record(
                "SQL_DISTINCT",
                lines["SELECT"],
                {
                    "table": plan["table"],
                    "columns": distinct_columns,
                    "rows": distinct_rows,
                    "removedRows": len(current_rows) - len(distinct_rows),
                    "operation": "Remove duplicate rows",
                },
            )

            current_rows = distinct_rows

        if "ORDER BY" in sections:
            sort_columns, sorted_rows = execute_rows(
                connection,
                build_query(plan, include_distinct=True, include_order=True),
                maximum_rows,
            )
            first_order = sections["ORDER BY"].split(",", 1)[0].strip()
            order_parts = first_order.rsplit(None, 1)
            direction = (
                order_parts[-1].upper()
                if len(order_parts) > 1 and order_parts[-1].upper() in {"ASC", "DESC"}
                else "ASC"
            )
            column = order_parts[0] if direction != "ASC" or len(order_parts) > 1 else first_order

            record(
                "SQL_SORT",
                lines["ORDER BY"],
                {
                    "table": plan["table"],
                    "column": column,
                    "direction": direction,
                    "expression": sections["ORDER BY"],
                    "columns": sort_columns,
                    "rows": sorted_rows,
                    "operation": f"ORDER BY {sections['ORDER BY']}",
                },
            )

            current_rows = sorted_rows

        if "LIMIT" in sections:
            limited_columns, limited_rows = execute_rows(
                connection,
                build_query(
                    plan,
                    include_distinct=True,
                    include_order=True,
                    include_limit=True,
                ),
                maximum_rows,
            )

            record(
                "SQL_LIMIT",
                lines["LIMIT"],
                {
                    "table": plan["table"],
                    "limit": sections["LIMIT"],
                    "columns": limited_columns,
                    "rows": limited_rows,
                    "rowCount": len(limited_rows),
                    "operation": f"LIMIT {sections['LIMIT']}",
                },
            )

            current_rows = limited_rows

        record(
            "SQL_RESULT",
            lines["SELECT"],
            {
                "table": plan["table"],
                "columns": final_columns,
                "rows": final_rows,
                "rowCount": len(final_rows),
                "verification": "matched-sqlite-result",
                "visualizationMode": "educational-logical-query",
                "operation": "Final query result",
            },
        )

        record(
            "OUTPUT",
            lines["SELECT"],
            {
                "channel": "result",
                "text": f"{len(final_rows)} row{'s' if len(final_rows) != 1 else ''} returned",
            },
        )

    return {
        "status": "ok",
        "events": events,
        "query": plan["source"],
        "selectLine": lines["SELECT"],
        "database": {
            "engine": "sqlite",
            "mode": "memory",
            "tables": sorted(ALLOWED_TABLES),
        },
    }


def main():
    raw_request = sys.stdin.buffer.read(MAXIMUM_INPUT_BYTES + 1)

    if len(raw_request) > MAXIMUM_INPUT_BYTES:
        write_response(
            {
                "status": "error",
                "error": {
                    "code": "SOURCE_POLICY_VIOLATION",
                    "message": "SQL worker request exceeded the maximum permitted size.",
                },
            }
        )
        return

    try:
        request = json.loads(raw_request.decode("utf-8"))
        source = request.get("source", "")
        maximum_trace_events = int(request.get("maximumTraceEvents", 1_000))
        maximum_rows = int(request.get("maximumRows", DEFAULT_MAXIMUM_ROWS))

        write_response(execute_logical_query(source, maximum_trace_events, maximum_rows))
    except SourcePolicyError as error:
        write_response(
            {
                "status": "error",
                "error": {
                    "code": "SOURCE_POLICY_VIOLATION",
                    "message": str(error),
                },
            }
        )
    except (QueryShapeError, TraceLimitError, sqlite3.Error) as error:
        write_response(
            {
                "status": "ok",
                "query": source if isinstance(source, str) else "",
                "selectLine": 1,
                "events": [
                    {
                        "type": "ERROR",
                        "line": 1,
                        "payload": {
                            "name": "SQLExecutionError",
                            "errorType": "SQLExecutionError",
                            "message": str(error),
                        },
                    }
                ],
                "database": {
                    "engine": "sqlite",
                    "mode": "memory",
                    "tables": sorted(ALLOWED_TABLES),
                },
            }
        )


if __name__ == "__main__":
    main()
