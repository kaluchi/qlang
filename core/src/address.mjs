// [QSNAM#address], [QSERR#site]

// [QSNAM#address]
export function splitAddress(name) {
  const cut = name.lastIndexOf('/');
  return cut < 0 ? [null, name] : [name.slice(0, cut), name.slice(cut + 1)];
}

export const ANY_KIND_NAME = 'any';
export const TAGGED_KIND_NAME = 'tagged';

// [QSERR#site]
export const subjectRefusalAddress = (address, labelName) => `${address}/SubjectNot${capitalOf(labelName)}Error`;
// [QSBLD#fn]
export const FN_CALL_ADDRESS = 'fn/call';
export const subjectKindsRefusalAddress = address => `${address}/SubjectKindNotTakenError`;
export const argsBeyondInputsAddress = address => `${address}/ArgsBeyondInputsError`;
export const notGivenAddress = holderAddress => `${holderAddress}/NotGivenError`;
// [QSBLD#value]
export const notReadAddress = holderAddress => `${holderAddress}/NotReadError`;
export const kindsRefusalAddress = address => `${address}/KindNotTakenError`;
export const elementsRefusalAddress = address => `${address}/ElementKindNotTakenError`;
export const payloadRefusalName = each => `${each ? 'Element' : 'Payload'}KindNotTakenError`;

const capitalOf = name => { const [, word] = splitAddress(name); return word[0].toUpperCase() + word.slice(1); };
