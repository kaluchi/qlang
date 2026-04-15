// Effectful I/O operands the CLI binds into every freshly-seeded
// session: `@in` reads stdin to a String, `@out` writes a String
// payload to stdout, `@err` writes to stderr, `@tap(:label)` is an
// identity step that mirrors the current pipeValue onto stderr with
// a labelled prefix for diagnostic.
//
// All four are host-bound rather than registered as `:qlang/io`
// module exports — a one-liner `qlang '@in | @out'` should not need
// `use(:qlang/io)` ceremony. The operand function values close over
// the writers passed in `ioContext`, so the same evaluator can run
// against `process.stdin`/`stdout`/`stderr` in the bin or against
// captured chunks in a unit test without changing the operand impls.
//
// Contracts (narrow, no auto-coercion):
//   `@in`            → String, ignores incoming pipeValue (producer).
//   `@out`           → String → stdout + '\n', identity on pipeValue.
//                      0 captured: subject must be String.
//                      1 captured: renderer evaluates against subject;
//                                  result must be String.
//   `@err`           → same shape as `@out`, writes to stderr instead.
//   `@tap(:label)`   → identity on (pipeValue, env). Writes
//                      `[tap label] <printValue(pipeValue)>\n` to
//                      stderr. Label must be a keyword.

import {
  nullaryOp,
  overloadedOp,
  stateOp
} from '@kaluchi/qlang-core/dispatch';
import {
  declareSubjectError,
  declareModifierError,
  declareShapeError
} from '@kaluchi/qlang-core/operand-errors';
import {
  isKeyword,
  describeType,
  printValue
} from '@kaluchi/qlang-core';

// ── Per-site error classes ─────────────────────────────────────

const OutSubjectNotString =
  declareSubjectError('OutSubjectNotString', '@out', 'String');
const OutRendererResultNotString =
  declareShapeError('OutRendererResultNotString',
    ({ actualType }) =>
      `@out renderer must produce a String, got ${actualType}`);

const ErrSubjectNotString =
  declareSubjectError('ErrSubjectNotString', '@err', 'String');
const ErrRendererResultNotString =
  declareShapeError('ErrRendererResultNotString',
    ({ actualType }) =>
      `@err renderer must produce a String, got ${actualType}`);

const TapLabelNotKeyword =
  declareModifierError('TapLabelNotKeyword', '@tap', 1, 'keyword');

// ── Operand factories ──────────────────────────────────────────

function makeInOperand(stdinReader) {
  return nullaryOp('@in', async () => stdinReader());
}

function makeWriterOperand(operandName, writer, recordEffect, SubjectError, RendererError) {
  return overloadedOp(operandName, 2, {
    0: (subject) => {
      if (typeof subject !== 'string') {
        throw new SubjectError(describeType(subject), subject);
      }
      writer(subject + '\n');
      recordEffect();
      return subject;
    },
    1: async (subject, rendererLambda) => {
      const rendered = await rendererLambda(subject);
      if (typeof rendered !== 'string') {
        throw new RendererError({
          actualType: describeType(rendered),
          actualValue: rendered
        });
      }
      writer(rendered + '\n');
      recordEffect();
      return subject;
    }
  });
}

function makeTapOperand(stderrWrite) {
  return stateOp('@tap', 2, async (state, lambdas) => {
    const labelValue = await lambdas[0](state.pipeValue);
    if (!isKeyword(labelValue)) {
      throw new TapLabelNotKeyword(describeType(labelValue), labelValue);
    }
    stderrWrite(`[tap ${labelValue.name}] ${printValue(state.pipeValue)}\n`);
    return state;
  });
}

// ── Binding ────────────────────────────────────────────────────

export function bindIoOperands(session, ioContext) {
  // `recordStdoutEffect` lets the script-mode renderer suppress its
  // implicit final encode when the user already pushed bytes to
  // stdout via `@out` — explicit output takes the channel; the
  // tool stops echoing. `@err` and `@tap` write to stderr and do
  // not flip the flag (stderr is diagnostic, not the primary
  // delivery channel). Optional in REPL-style ioContexts that do
  // not care about double-output suppression.
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  const noopEffect = () => {};

  session.bind('@in',  makeInOperand(ioContext.stdinReader));
  session.bind('@out', makeWriterOperand(
    '@out', ioContext.stdoutWrite, recordStdoutEffect,
    OutSubjectNotString, OutRendererResultNotString));
  session.bind('@err', makeWriterOperand(
    '@err', ioContext.stderrWrite, noopEffect,
    ErrSubjectNotString, ErrRendererResultNotString));
  session.bind('@tap', makeTapOperand(ioContext.stderrWrite));
}
