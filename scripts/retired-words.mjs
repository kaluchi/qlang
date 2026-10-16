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
];
