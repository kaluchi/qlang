// The primitives of the streams of the command line, `in`, `out`,
// `err` and `tap`, names its source declares under `::any` [QSDSP#residence],
// each taking the values alone, the subject and the inputs of its call
// [QSBLD#fn].

import { printValue } from '@kaluchi/qlang-core';
import { declareRefusal, refusingTheSubject } from '@kaluchi/qlang-core/errors';

const AnyOutSubjectNotStringError = declareRefusal('any/out/SubjectNotStringError');
const AnyErrSubjectNotStringError = declareRefusal('any/err/SubjectNotStringError');

// A writer takes the text the call gives, or bare, its subject, which is
// then a string; the subject passes on either way.
function makeWriter(writer, recordEffect, SubjectError) {
  return (subject, text) => {
    const written = text === null ? subject : text;
    if (typeof written !== 'string') throw refusingTheSubject(new SubjectError({ actualValue: subject }));
    writer(written + '\n');
    recordEffect();
    return subject;
  };
}

export function streamPrimitives(ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  return {
    'any/in':  async () => ioContext.stdinReader(),
    'any/out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, AnyOutSubjectNotStringError),
    'any/err': makeWriter(ioContext.stderrWrite, () => {}, AnyErrSubjectNotStringError),
    'any/tap': (subject, label) => {
      ioContext.stderrWrite(`[tap ${label.name}] ${printValue(subject)}\n`);
      return subject;
    }
  };
}
