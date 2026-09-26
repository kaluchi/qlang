// Effectful I/O implementations for the `:cli/io` host catalog —
// `@in` reads stdin, `@out` writes stdout, `@err` writes stderr,
// `@tap :label` mirrors pipeValue to stderr with a labelled prefix.
// Each is a plain function over the values the head of its verb checks
// [D80]; the catalog declaration lives in `cli/lib/qlang/io.qlang`, and
// the locator at `cli/src/cli-locator.mjs` hands these beside the
// source.

import {
  declareSubjectError,
  declareModifierError
} from '@kaluchi/qlang-core/operand-errors';
import { printValue } from '@kaluchi/qlang-core';

const OutSubjectNotStringError = declareSubjectError('OutSubjectNotStringError', '@out', 'string');
declareModifierError('OutRendererResultNotStringError', '@out', 2, 'string');
const ErrSubjectNotStringError = declareSubjectError('ErrSubjectNotStringError', '@err', 'string');
declareModifierError('ErrRendererResultNotStringError', '@err', 2, 'string');
declareModifierError('TapLabelNotKeywordError', '@tap', 2, 'keyword');

// A writer takes the text the call gives, or bare, its subject, which is
// then a string; the subject passes on either way.
function makeWriter(writer, recordEffect, SubjectError) {
  return (subject, text) => {
    const written = text === null ? subject : text;
    if (typeof written !== 'string') throw new SubjectError(subject);
    writer(written + '\n');
    recordEffect();
    return subject;
  };
}

export function makeIoImpls(ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  return {
    '@in':  async () => ioContext.stdinReader(),
    '@out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, OutSubjectNotStringError),
    '@err': makeWriter(ioContext.stderrWrite, () => {}, ErrSubjectNotStringError),
    '@tap': (subject, label) => {
      ioContext.stderrWrite(`[tap ${label.name}] ${printValue(subject)}\n`);
      return subject;
    }
  };
}
