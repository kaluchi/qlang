// The primitives of the streams of the command line, `@in`, `@out`,
// `@err` and `@tap`, verbs its source declares under `::any` [D153],
// each a plain function over the values the head of its verb checks
// [D80].

import {
  declareSubjectError
} from '@kaluchi/qlang-core/operand-errors';
import { printValue } from '@kaluchi/qlang-core';

const AnyOutSubjectNotStringError = declareSubjectError('any/OutSubjectNotStringError', '@out', 'string');
const AnyErrSubjectNotStringError = declareSubjectError('any/ErrSubjectNotStringError', '@err', 'string');

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
    'any/@out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, AnyOutSubjectNotStringError),
    'any/@err': makeWriter(ioContext.stderrWrite, () => {}, AnyErrSubjectNotStringError),
    'any/@tap': (subject, label) => {
      ioContext.stderrWrite(`[tap ${label.name}] ${printValue(subject)}\n`);
      return subject;
    }
  };
}
