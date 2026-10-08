// The primitives of the streams of the command line, `@in`, `@out`,
// `@err` and `@tap`, verbs its source declares under `::any` [D153],
// each a plain function over the values the head of its verb checks
// [D80].

import {
  declareSubjectError,
  declareModifierError
} from '@kaluchi/qlang-core/operand-errors';
import { printValue } from '@kaluchi/qlang-core';

const OutSubjectNotStringError = declareSubjectError('any/OutSubjectNotStringError', '@out', 'string');
declareModifierError('any/OutRendererResultNotStringError', '@out', 2, 'string');
const ErrSubjectNotStringError = declareSubjectError('any/ErrSubjectNotStringError', '@err', 'string');
declareModifierError('any/ErrRendererResultNotStringError', '@err', 2, 'string');
declareModifierError('any/TapLabelNotKeywordError', '@tap', 2, 'keyword');

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
    'any/@in':  async () => ioContext.stdinReader(),
    'any/@out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, OutSubjectNotStringError),
    'any/@err': makeWriter(ioContext.stderrWrite, () => {}, ErrSubjectNotStringError),
    'any/@tap': (subject, label) => {
      ioContext.stderrWrite(`[tap ${label.name}] ${printValue(subject)}\n`);
      return subject;
    }
  };
}
