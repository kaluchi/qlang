// The primitives of the streams of the command line, `in`, `out`,
// `err` and `tap`, names its source declares under `::any` [QSDSP#residence],
// each taking the values alone, the subject and the inputs of its call
// [QSBLD#fn], but `tap`, which reads the state of its call [D397].

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

export function streamPrimitives(ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  return {
    'any/in':  async () => ioContext.stdinReader(),
    'any/out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, AnyOutSubjectKindNotTakenError),
    'any/err': makeWriter(ioContext.stderrWrite, () => {}, AnyErrSubjectKindNotTakenError),
    // `tap` writes its subject as a host prints an answer, within the budget
    // of every answer and past it as the refusal in its place [D397].
    'any/tap': readingState(async (subject, label, state) => {
      const shown = await printAnswer(await boundAnswer(subject, state.scope), state.scope);
      ioContext.stderrWrite(`[tap ${label.name}] ${shown}\n`);
      return subject;
    })
  };
}
