// The kind [QSBLD#kind]: the constructor of `::kind`, which reads a kind
// from its literal, the commands of its chain folded into data and the
// constructor a host hands a kind of the core, and the verbs that build one
// from the noun by commands, each writing its command after the ones the kind
// holds, its constructor last.

import { registerPrimitive } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { chainOfKind, KIND_COMMAND_NAMES } from '../chain.mjs';
import { commandStep } from '../steps.mjs';
import {
  isVec, isNull, isQuote, isBuiltinDescriptor, isKind, commandsOf, constructorOf,
  makeTag, makeTagged, makeQuote, holdsNoOtherTag, KIND_TAG_NAME
} from '../types.mjs';

const KIND_TAG = makeTag(KIND_TAG_NAME);

const KindPayloadNotPairError = declareRefusal('kind/PayloadNotPairError');
const KindConstructorKindNotTakenError = declareRefusal('kind/ConstructorKindNotTakenError');

// A kind of its commands and its constructor, held here on every road to one: a
// constructor that is no `::builtin{}` and a command its chain does not take are refused [QSBLD#kind].
function madeKind(commands, constructor) {
  if (!(isNull(constructor) || isBuiltinDescriptor(constructor))) throw new KindConstructorKindNotTakenError({ expected: kindsExpected('builtin', 'null'), actualValue: constructor });
  const kind = makeTagged(KIND_TAG, Object.freeze([commands, constructor]));
  chainOfKind(kind);
  return kind;
}

// `::kind[commands constructor]` — a kind from its literal, the quote of its
// commands and the constructor a host hands a kind of the core, or null for a
// kind its commands alone build [QSLIT#tag]; another payload is refused.
registerPrimitive('kind/construct', payload => {
  if (!isVec(payload) || !holdsNoOtherTag(payload, KIND_TAG_NAME) || payload.length !== 2 || !isQuote(payload[0])) throw new KindPayloadNotPairError({ actualValue: payload });
  return madeKind(...payload);
});

// The kind a command of its chain runs on: a kind, or the noun itself,
// which starts the kind of no commands and no constructor; the call
// refuses a tag of another noun before the command runs [QSDSP#tagname].
const NO_KIND = madeKind(makeQuote([]), null);

const kindFrom = subject => (isKind(subject) ? subject : NO_KIND);

// Each command of a chain, `reads :w |~~ The width. ~~| /w ::number`, written
// by its verb after the ones the kind holds with the objects the verb is called
// with, as written, which the chain holds [QSBLD#kind].
for (const command of KIND_COMMAND_NAMES) {
  registerPrimitive(`kind/${command}`, (subject, objects) => {
    const kind = kindFrom(subject);
    return madeKind(makeQuote([...commandsOf(kind), commandStep(command, [...objects])]), constructorOf(kind));
  });
}

// `impl ::builtin{}` — the constructor a host hands a kind of the core
// [QSLIT#tag].
registerPrimitive('kind/impl', (subject, constructor) => madeKind(commandsOf(kindFrom(subject)), constructor));
