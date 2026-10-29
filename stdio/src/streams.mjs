// [QSDSP#residence], [QSBLD#fn], [QSHST#source]

import { kindsExpected, readingState, boundAnswer, printAnswer } from '@kaluchi/qlang-core';
import { declareRefusal } from '@kaluchi/qlang-core/errors';
import { keepCell } from './cells.mjs';

const StdioOutSubjectKindNotTakenError = declareRefusal('stdio/out/SubjectKindNotTakenError');
const StdioErrSubjectKindNotTakenError = declareRefusal('stdio/err/SubjectKindNotTakenError');

// [QSERR#site]
function makeWriter(writer, recordEffect, SubjectError) {
  return (subject, text) => {
    const written = text === null ? subject : text;
    if (typeof written !== 'string') throw new SubjectError({ 'subject/expected': kindsExpected('string') });
    writer(written + '\n');
    recordEffect();
    return subject;
  };
}

export function streamPrimitives(ioContext) {
  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
  return {
    'stdio/in': async () => ioContext.stdinReader(),
    'stdio/out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, StdioOutSubjectKindNotTakenError),
    'stdio/err': makeWriter(ioContext.stderrWrite, () => {}, StdioErrSubjectKindNotTakenError),
    // [QSHST#effect], [QSHST#cell]
    'stdio/tap': readingState(async (subject, label, state) => {
      const kept = value => keepCell({ query: ioContext.query, scope: state.scope, value });
      const shown = await printAnswer(await boundAnswer(subject, state.scope, null, kept), state.scope);
      ioContext.stderrWrite(`[tap ${label.name}] ${shown}\n`);
      return subject;
    })
  };
}
