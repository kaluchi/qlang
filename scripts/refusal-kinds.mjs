// The kinds the name of a refusal carries [QSERR#site]: a kind its last name
// names after `Not` is one its address names too, the label its subject
// resides on or the kind a conversion reads, so the name moves only with the
// word, and any other refusal of a kind is named by the role of its holder.

const KIND_AFTER_NOT = /Not((?:[A-Z][a-z]+)(?:Or[A-Z][a-z]+)*)Error$/;

// kindsNamedOffTheirAddress(refusals, nouns) → each refusal, `{ address, … }`,
// whose last name names after `Not` a noun of `nouns` its address does not,
// those nouns its `kinds`.
export function kindsNamedOffTheirAddress(refusals, nouns) {
  return refusals.flatMap(refusal => {
    const segments = refusal.address.split('/');
    const named = KIND_AFTER_NOT.exec(segments.at(-1))?.[1].split('Or').map(word => word.toLowerCase()) ?? [];
    const place = segments.slice(0, -1).map(segment => segment.toLowerCase());
    const kinds = named.filter(kind => nouns.has(kind) && !place.some(segment => segment === kind || segment === `to${kind}`));
    return kinds.length === 0 ? [] : [{ ...refusal, kinds }];
  });
}
