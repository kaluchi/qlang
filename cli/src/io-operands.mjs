// Effectful I/O operands the CLI binds into every freshly-seeded
// session: `@in` reads stdin to a String, `@out` writes a String
// payload to stdout, `@err` writes to stderr, `@tap(:label)` is an
// identity step that mirrors the current pipeValue onto stderr with
// a labelled prefix for diagnostic.
//
// All four are host-bound directly into the session env, so a
// one-liner `qlang '@in | @out'` runs without `use(:qlang/io)`
// ceremony. The operand function values close over
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

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  typeKeyword,
  printValue
} from '@kaluchi/qlang-core';
import { bindCatalog } from '@kaluchi/qlang-core/host/catalog';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_SOURCE = readFileSync(
  join(__dirname, '..', 'lib', 'qlang', 'io.qlang'), 'utf8');

// ── Per-site error classes ─────────────────────────────────────

const OutSubjectNotStringError =
  declareSubjectError('OutSubjectNotStringError', '@out', 'string');
const OutRendererResultNotStringError =
  declareShapeError('OutRendererResultNotStringError',
    ({ actualType }) =>
      `@out renderer must produce a String, got ${actualType.name}`);

const ErrSubjectNotStringError =
  declareSubjectError('ErrSubjectNotStringError', '@err', 'string');
const ErrRendererResultNotStringError =
  declareShapeError('ErrRendererResultNotStringError',
    ({ actualType }) =>
      `@err renderer must produce a String, got ${actualType.name}`);

const TapLabelNotKeywordError =
  declareModifierError('TapLabelNotKeywordError', '@tap', 1, 'keyword');

// ── Operand factories ──────────────────────────────────────────

function makeInOperand(stdinReader) {
  return nullaryOp('@in', async () => stdinReader());
}

function makeWriterOperand(operandName, writer, recordEffect, SubjectError, RendererError) {
  return overloadedOp(operandName, 2, {
    0: (subject) => {
      if (typeof subject !== 'string') {
        throw new SubjectError(subject);
      }
      writer(subject + '\n');
      recordEffect();
      return subject;
    },
    1: async (subject, rendererLambda) => {
      const rendered = await rendererLambda(subject);
      if (typeof rendered !== 'string') {
        throw new RendererError({
          actualType: typeKeyword(rendered),
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
      throw new TapLabelNotKeywordError(labelValue);
    }
    stderrWrite(`[tap ${labelValue.name}] ${printValue(state.pipeValue)}\n`);
    return state;
  });
}

// ── Binding ────────────────────────────────────────────────────

export async function bindIoOperands(session, ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  const noopEffect = () => {};

  await bindCatalog(session, {
    source: CATALOG_SOURCE,
    uri: 'cli/io',
    impls: {
      '@in':  makeInOperand(ioContext.stdinReader),
      '@out': makeWriterOperand(
        '@out', ioContext.stdoutWrite, recordStdoutEffect,
        OutSubjectNotStringError, OutRendererResultNotStringError),
      '@err': makeWriterOperand(
        '@err', ioContext.stderrWrite, noopEffect,
        ErrSubjectNotStringError, ErrRendererResultNotStringError),
      '@tap': makeTapOperand(ioContext.stderrWrite)
    }
  });
}
