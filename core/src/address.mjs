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
// [QSERR#site]
export const SLOT_KIND_ADDRESS = 'fn/slot';
export const subjectKindsRefusalAddress = address => `${address}/SubjectKindNotTakenError`;
export const argsBeyondInputsAddress = address => `${address}/ArgsBeyondInputsError`;
export const notGivenAddress = slotAddress => refusalOfASlot(slotAddress, 'NotGivenError');
// [QSBLD#value]
export const notReadAddress = slotAddress => refusalOfASlot(slotAddress, 'NotReadError');
export const kindsRefusalAddress = slotAddress => refusalOfASlot(slotAddress, 'KindNotTakenError');
export const elementsRefusalAddress = slotAddress => refusalOfASlot(slotAddress, 'ElementKindNotTakenError');
// [QSQUO#modifier]
export const quotedRefusalAddress = slotAddress => refusalOfASlot(slotAddress, 'QuotedError');
export const quotedTwiceRefusalAddress = slotAddress => refusalOfASlot(slotAddress, 'QuotedTwiceError');
export const payloadRefusalName = each => `${each ? 'Element' : 'Payload'}KindNotTakenError`;

const raised = word => word[0].toUpperCase() + word.slice(1);
const capitalOf = name => raised(splitAddress(name)[1]);

// [QSERR#site]
function refusalOfASlot(slotAddress, rule) {
  const [holder, slot] = splitAddress(slotAddress);
  return `${holder === null ? '' : `${holder}/`}${raised(slot)}${rule}`;
}
