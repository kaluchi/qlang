// The terms of the earlier models of the language that its later work
// retired, each a pattern of one sense with the term written in its place
// and the record that retired it [D350]: a text that states what holds
// writes none of them [QSWRK#documents], and a record that retires a term
// of the language adds it here in the commit that retires it.

export const RETIRED_WORDS = [
  { pattern: /\bdeflect(?:s|ed|ing|ions?)?\b/i, written: '`skipped`, the steps a failure skips', by: 'D347' },
  { pattern: /\bre-?lift(?:s|ed|ing)?\b/i, written: 'raise again, `raise`', by: 'D347' },
  { pattern: /\bfail-apply\b/i, written: 'the catch, `!|`', by: 'D347' },
  { pattern: /\bmint(?:s|ed|ing)?\b/i, written: 'lay a tag, `layTag`', by: 'D338' },
  { pattern: /\bsigils?\b/i, written: 'the sign of a literal', by: 'D347' },
  { pattern: /\bplain comments?\b/i, written: 'a comment', by: 'D347' },
  { pattern: /\bKeyNotKeyword(?:OrString)?Error\b/, written: 'the name by the role, `KeyKindNotTakenError`, and under the input of the keys `keys/ElementKindNotTakenError`', by: 'D355' },
  { pattern: /\bValueMeetsWordError\b/, written: 'a value that meets a verb of its name, `ValueMeetsVerbError`', by: 'D352' },
  { pattern: /\bisWord\b/, written: 'whether a name under a label is a verb, `isVerb`', by: 'D352' },
  { pattern: /\bdeclaresWord\b/, written: 'whether a declaration declares a verb, `declaresVerb`', by: 'D352' },
  { pattern: /\bfn\/params\b|(?:[|~]|(?<![\w$])\()\s*params\b|`params`/, written: 'the inputs a function declares, `inputs`', by: 'D352' },
  { pattern: /\btypeKeyword\b/, written: 'the kind of a value, the tag `type` answers, `typeOf`', by: 'D352' },
  { pattern: /::any\/source\/name\b|\bsource\/name\/KindNotTakenError\b/, written: 'the anchor `source` takes, `::any/source/anchor`, refused as `source/anchor/KindNotTakenError`', by: 'D352' },
  { pattern: /::boolean\/(?:and|or)\/right\b|\b(?:and|or)\/right\/KindNotTakenError\b/, written: 'the condition `and` and `or` take, `::boolean/and/condition`, refused as `and/condition/KindNotTakenError`', by: 'D352' },
];
