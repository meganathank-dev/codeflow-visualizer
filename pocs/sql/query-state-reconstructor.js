"use strict";

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const childValue of Object.values(value)) {
    deepFreeze(childValue);
  }

  return value;
}

function createInitialQueryState() {
  return deepFreeze({
    step: -1,
    status: "idle",
    currentEvent: null,
    sourceLocation: null,

    query: {
      text: "",
      mode: null,
      database: null,
    },

    scan: {
      table: null,
      columns: [],
      rows: [],
      rowCount: 0,
    },

    filter: {
      predicate: null,
      evaluations: [],
      matchingRows: [],
      rejectedRows: [],
    },

    projection: {
      columns: [],
      inputRows: [],
      rows: [],
    },

    sort: {
      column: null,
      direction: null,
      inputRows: [],
      rows: [],
    },

    result: {
      columns: [],
      rows: [],
      rowCount: 0,
      verification: null,
    },

    pipeline: [],
    errors: [],
  });
}

function validateEvent(event, expectedSequence) {
  if (!event || typeof event !== "object") {
    throw new TypeError(
      "SQL execution event must be an object."
    );
  }

  if (event.sequence !== expectedSequence) {
    throw new Error(
      `Expected SQL event sequence ${expectedSequence}, ` +
        `received ${event.sequence}.`
    );
  }

  if (event.domain !== "QUERY_EXECUTION") {
    throw new Error(
      `Expected QUERY_EXECUTION domain, received ${event.domain}.`
    );
  }
}

function addPipelineStage(
  state,
  event,
  label
) {
  state.pipeline.push({
    step: event.sequence,
    type: event.type,
    label,
  });
}

function applyQueryEvent(previousState, event) {
  validateEvent(event, previousState.step + 1);

  const state = clone(previousState);
  const payload = event.payload ?? {};

  state.step = event.sequence;
  state.currentEvent = {
    eventId: event.eventId,
    type: event.type,
  };
  state.sourceLocation = clone(event.source);

  switch (event.type) {
    case "SQL_QUERY_START": {
      state.status = "running";
      state.query = {
        text: payload.query,
        mode: payload.mode,
        database: payload.database,
      };

      addPipelineStage(
        state,
        event,
        "Start query"
      );

      break;
    }

    case "SQL_SCAN": {
      state.scan = {
        table: payload.table,
        columns: clone(payload.columns),
        rows: clone(payload.rows),
        rowCount: payload.rowCount,
      };

      addPipelineStage(
        state,
        event,
        `Scan ${payload.table}`
      );

      break;
    }

    case "SQL_FILTER": {
      if (
        state.filter.predicate !==
        payload.predicate
      ) {
        state.filter = {
          predicate: payload.predicate,
          evaluations: [],
          matchingRows: [],
          rejectedRows: [],
        };
      }

      const evaluation = {
        rowIndex: payload.rowIndex,
        row: clone(payload.row),
        leftValue: clone(payload.leftValue),
        operator: payload.operator,
        rightValue: clone(payload.rightValue),
        result: payload.result,
      };

      state.filter.evaluations.push(evaluation);

      if (payload.result) {
        state.filter.matchingRows.push(
          clone(payload.row)
        );
      } else {
        state.filter.rejectedRows.push(
          clone(payload.row)
        );
      }

      addPipelineStage(
        state,
        event,
        `Filter row ${payload.rowIndex + 1}: ${
          payload.result ? "match" : "reject"
        }`
      );

      break;
    }

    case "SQL_PROJECT": {
      state.projection = {
        columns: clone(payload.columns),
        inputRows: clone(payload.inputRows),
        rows: clone(payload.rows),
      };

      addPipelineStage(
        state,
        event,
        `Project ${payload.columns.join(", ")}`
      );

      break;
    }

    case "SQL_SORT": {
      state.sort = {
        column: payload.column,
        direction: payload.direction,
        inputRows: clone(payload.inputRows),
        rows: clone(payload.rows),
      };

      addPipelineStage(
        state,
        event,
        `Sort ${payload.column} ${payload.direction}`
      );

      break;
    }

    case "SQL_RESULT": {
      state.status = payload.status ?? "completed";

      state.result = {
        columns: clone(payload.columns),
        rows: clone(payload.rows),
        rowCount: payload.rowCount,
        verification: payload.verification,
      };

      addPipelineStage(
        state,
        event,
        "Generate result"
      );

      break;
    }

    case "ERROR": {
      state.status = "error";

      state.errors.push({
        step: event.sequence,
        errorType:
          payload.errorType ?? "SQLExecutionError",
        message:
          payload.message ?? "Unknown SQL error.",
      });

      addPipelineStage(
        state,
        event,
        "Query error"
      );

      break;
    }

    default: {
      break;
    }
  }

  return deepFreeze(state);
}

function reconstructQueryState(
  events,
  targetStep = events.length - 1
) {
  if (!Array.isArray(events)) {
    throw new TypeError(
      "SQL events must be an array."
    );
  }

  if (
    !Number.isInteger(targetStep) ||
    targetStep < -1 ||
    targetStep >= events.length
  ) {
    throw new RangeError(
      `targetStep must be between -1 and ${
        events.length - 1
      }.`
    );
  }

  let state = createInitialQueryState();

  for (
    let index = 0;
    index <= targetStep;
    index += 1
  ) {
    state = applyQueryEvent(
      state,
      events[index]
    );
  }

  return state;
}

function reconstructAllQueryStates(events) {
  if (!Array.isArray(events)) {
    throw new TypeError(
      "SQL events must be an array."
    );
  }

  const states = [];
  let state = createInitialQueryState();

  for (const event of events) {
    state = applyQueryEvent(state, event);
    states.push(state);
  }

  return deepFreeze(states);
}

module.exports = {
  applyQueryEvent,
  createInitialQueryState,
  reconstructAllQueryStates,
  reconstructQueryState,
};