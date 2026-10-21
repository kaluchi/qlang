// The primitives of the streams of the command line, `in`, `out`,
// `err` and `tap`, names its source declares under `::any` [QSDSP#residence],
// each taking the values alone, the subject and the inputs of its call
// [QSBLD#fn], but `tap`, which reads the state of its call [QSHST#source].

import { kindsExpected, readingState, boundAnswer, printAnswer } from '@kaluchi/qlang-core';
import { declareRefusal, refusingTheSubject } from '@kaluchi/qlang-core/errors';

const AnyOutSubjectKindNotTakenError = declareRefusal('any/out/SubjectKindNotTakenError');
const AnyErrSubjectKindNotTakenError = declareRefusal('any/err/SubjectKindNotTakenError');

// A writer takes the text the call gives, or bare, its subject, which is
// then a string; the subject passes on either way [QSERR#site].
function makeWriter(writer, recordEffect, SubjectError) {
  return (subject, text) => {
    const written = text === null ? subject : text;
    if (typeof written !== 'string') throw refusingTheSubject(new SubjectError({ expected: kindsExpected('string'), actualValue: subject }));
    writer(written + '\n');
    recordEffect();
    return subject;
  };
}

// The address of `in`, which reads no subject [QSCLI#stdin].
export const IN_ADDRESS = 'any/in';

export function streamPrimitives(ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  return {
    [IN_ADDRESS]: async () => ioContext.stdinReader(),
    'any/out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, AnyOutSubjectKindNotTakenError),
    'any/err': makeWriter(ioContext.stderrWrite, () => {}, AnyErrSubjectKindNotTakenError),
    // `tap` writes its subject as a host prints an answer [QSHST#effect].
    'any/tap': readingState(async (subject, label, state) => {
      const shown = await printAnswer(await boundAnswer(subject, state.scope), state.scope);
      ioContext.stderrWrite(`[tap ${label.name}] ${shown}\n`);
      return subject;
    })
  };
}
