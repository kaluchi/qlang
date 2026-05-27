// Effectful I/O operand impls for the `:cli/io` host catalog —
// `@in` reads stdin, `@out` writes stdout, `@err` writes stderr,
// `@tap(:label)` mirrors pipeValue to stderr with a labelled
// prefix. Catalog declaration lives in `cli/lib/qlang/io.qlang`;
// the locator at `cli/src/cli-locator.mjs` hands these impls
// alongside the source through `runtime/use-op.mjs`'s
// resolveNamespaceEnv path — same surface every catalog-loaded
// namespace rides on.

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

export function makeIoImpls(ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  const noopEffect = () => {};
  return {
    '@in':  makeInOperand(ioContext.stdinReader),
    '@out': makeWriterOperand(
      '@out', ioContext.stdoutWrite, recordStdoutEffect,
      OutSubjectNotStringError, OutRendererResultNotStringError),
    '@err': makeWriterOperand(
      '@err', ioContext.stderrWrite, noopEffect,
      ErrSubjectNotStringError, ErrRendererResultNotStringError),
    '@tap': makeTapOperand(ioContext.stderrWrite)
  };
}
