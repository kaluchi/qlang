// The address of a name, the names of the kinds every value and every value
// under a tag answer, and the addresses of the refusals the runtime raises by
// rule [QSNAM#address], [QSERR#site].

// splitAddress(name) → the noun a name is declared under and its last
// name, by which a step calls it, `['vec', 'count']` for `vec/count`, the
// noun null for a name of one segment [QSNAM#address].
export function splitAddress(name) {
  const cut = name.lastIndexOf('/');
  return cut < 0 ? [null, name] : [name.slice(0, cut), name.slice(cut + 1)];
}

export const ANY_KIND_NAME = 'any';
export const TAGGED_KIND_NAME = 'tagged';

// The refusals the runtime raises by rule under a verb, each named by the
// address of what refused [QSERR#site]: a subject the walk of
// whose tags reaches no value of the verb's label, args of more values than
// its inputs read places, an input the call leaves out where its place reads
// one, and an answer that reaches none of the kinds `returns` names; and under
// a kind, a payload of none of its kinds, or an element of none, a refusal of
// kinds named by the role of its holder alone, the subject's by its label [D389].
export const subjectRefusalAddress = (address, labelName) => `${address}/SubjectNot${capitalOf(labelName)}Error`;
// The call of a function `apply` runs or `fill` fills, under which every refusal of
// it is named, its subject refused by its role, the kinds `on` names its `:expected` [QSBLD#fn].
export const FN_CALL_ADDRESS = 'fn/call';
export const subjectKindsRefusalAddress = address => `${address}/SubjectKindNotTakenError`;
export const argsBeyondInputsAddress = address => `${address}/ArgsBeyondInputsError`;
export const notGivenAddress = holderAddress => `${holderAddress}/NotGivenError`;
export const kindsRefusalAddress = address => `${address}/KindNotTakenError`;
export const elementsRefusalAddress = address => `${address}/ElementKindNotTakenError`;
export const payloadRefusalName = each => `${each ? 'Element' : 'Payload'}KindNotTakenError`;

const capitalOf = name => { const [, word] = splitAddress(name); return word[0].toUpperCase() + word.slice(1); };
