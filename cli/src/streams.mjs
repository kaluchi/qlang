// [QSDSP#residence], [QSBLD#fn], [QSHST#source]

import { kindsExpected, readingState, boundAnswer, printAnswer } from '@kaluchi/qlang-core';
import { declareRefusal, refusingTheSubject } from '@kaluchi/qlang-core/errors';
import { keepCell } from './cells.mjs';

const AnyOutSubjectKindNotTakenError = declareRefusal('any/out/SubjectKindNotTakenError');
const AnyErrSubjectKindNotTakenError = declareRefusal('any/err/SubjectKindNotTakenError');

// [QSERR#site]
function makeWriter(writer, recordEffect, SubjectError) {
  return (subject, text) => {
    const written = text === null ? subject : text;
    if (typeof written !== 'string') throw refusingTheSubject(new SubjectError({ expected: kindsExpected('string'), actualValue: subject }));
    writer(written + '\n');
    recordEffect();
    return subject;
  };
}

// [QSCLI#stdin]
export const IN_ADDRESS = 'any/in';

export function streamPrimitives(ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  return {
    [IN_ADDRESS]: async () => ioContext.stdinReader(),
    'any/out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, AnyOutSubjectKindNotTakenError),
    'any/err': makeWriter(ioContext.stderrWrite, () => {}, AnyErrSubjectKindNotTakenError),
    // [QSHST#effect], [QSHST#cell]
    'any/tap': readingState(async (subject, label, state) => {
      const kept = answer => keepCell({ query: ioContext.query, scope: state.scope, answer });
      const shown = await printAnswer(await boundAnswer(subject, state.scope, null, kept), state.scope);
      ioContext.stderrWrite(`[tap ${label.name}] ${shown}\n`);
      return subject;
    })
  };
}
