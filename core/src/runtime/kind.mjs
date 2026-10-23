// [QSBLD#kind]

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

function madeKind(commands, constructor) {
  if (!(isNull(constructor) || isBuiltinDescriptor(constructor))) throw new KindConstructorKindNotTakenError({ expected: kindsExpected('builtin', 'null'), actualValue: constructor });
  const kind = makeTagged(KIND_TAG, Object.freeze([commands, constructor]));
  chainOfKind(kind);
  return kind;
}

// [QSLIT#tag]
registerPrimitive('kind', payload => {
  if (!isVec(payload) || !holdsNoOtherTag(payload, KIND_TAG_NAME) || payload.length !== 2 || !isQuote(payload[0])) throw new KindPayloadNotPairError({ actualValue: payload });
  return madeKind(...payload);
});

// [QSDSP#tagname]
const NO_KIND = madeKind(makeQuote([]), null);

const kindFrom = subject => (isKind(subject) ? subject : NO_KIND);

// [QSBLD#kind]
for (const command of KIND_COMMAND_NAMES) {
  registerPrimitive(`kind/${command}`, (subject, objects) => {
    const kind = kindFrom(subject);
    return madeKind(makeQuote([...commandsOf(kind), commandStep(command, [...objects])]), constructorOf(kind));
  });
}

// [QSLIT#tag]
registerPrimitive('kind/impl', (subject, constructor) => madeKind(commandsOf(kindFrom(subject)), constructor));
