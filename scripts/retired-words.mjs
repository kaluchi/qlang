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
  { pattern: /\bfn\/params\b|[|~]\s*params\b|~\(\s*params\b|`params`/, written: 'the inputs a function declares, `inputs`', by: 'D352' },
  { pattern: /\btypeKeyword\b/, written: 'the kind of a value, the tag `type` answers, `typeOf`', by: 'D352' },
  { pattern: /::any\/source\/name\b|\bsource\/name\/KindNotTakenError\b/, written: 'the anchor `source` takes, `::any/source/anchor`, refused as `source/anchor/KindNotTakenError`', by: 'D352' },
  { pattern: /::boolean\/(?:and|or)\/right\b|\b(?:and|or)\/right\/KindNotTakenError\b/, written: 'the condition `and` and `or` take, `::boolean/and/condition`, refused as `and/condition/KindNotTakenError`', by: 'D352' },
  { pattern: /::holds\b|\bqlang\/holds\b/, written: 'the kind of an invariant, `::invariant`, which the command `holds` writes', by: 'D357' },
  { pattern: /\bSignatureNotCommandsError\b/, written: 'a payload that is no pair of the quote of a chain and its recipe or its constructor, `PayloadNotPairError`, and a step of a chain written with args its rules do not take, `CommandNotTakenError`', by: 'D357' },
  { pattern: /\bRecipeNotBuiltinError\b/, written: 'a constructor of a kind that is no `::builtin{}`, `ConstructorNotBuiltinError`', by: 'D357' },
  { pattern: /\bkind\/impl\/recipe\b/, written: 'the constructor `impl` gives a kind, `::kind/impl/constructor`', by: 'D357' },
  { pattern: /\bsignatureOf\b/, written: 'the roles of the chain of a function, `chainOfFn`', by: 'D357' },
  { pattern: /\breadSignature\b/, written: 'the roles the chain of a function declares, read once by `chainOfFn`', by: 'D357' },
  { pattern: /\breadKindSignature\b/, written: 'the roles the chain of a kind declares, read once by `chainOfKind`', by: 'D357' },
  { pattern: /\bEMPTY_SIGNATURE\b/, written: 'the quote of no commands, `NO_COMMANDS`', by: 'D357' },
  { pattern: /\bsignature\.mjs\b/, written: 'the module of the chain of a function and of a kind, `core/src/runtime/chain.mjs`', by: 'D357' },
  { pattern: /\bsignatures?[\s-]+of[\s-]+(?:a|an|the|its)[\s-]+(?:functions?|commands?|verbs?|kinds?|chains?)\b|\bnames?[\s-]+of[\s-]+(?:a|the|its)[\s-]+signatures?\b/i, written: 'the chain of a function or of a kind, the commands written on it, and the form of a call that the signature help of the language server shows', by: 'D357' },
  { pattern: /\bcallMemberOn\b/, written: 'the answer of a verb run on a subject, `callVerbOn`', by: 'D357' },
  { pattern: /\bisMemberValue\b/, written: 'whether a value is the value of a verb, `isVerbValue`', by: 'D357' },
  { pattern: /\bnearestMembers\b/, written: 'the nodes near an anchor the subject holds no node under, `nearestNodes`', by: 'D357' },
  { pattern: /\bmemberRecordOf\b/, written: 'the node a subject holds under an anchor, `nodeUnderAnchor`', by: 'D357' },
  { pattern: /\bmemberRefusalOf\b/, written: 'what the refusal of an anchor holds, `anchorRefusalOf`', by: 'D357' },
  { pattern: /\brecordAlongPath\b/, written: 'the record anchors read in turn reach, `recordOfAnchors`', by: 'D357' },
  { pattern: /\bmembers?\b(?=\s+(?:(?:the|a|its)\s+(?:subject|value|number|tag|page)\s+(?:holds|lacks)|it\s+(?:holds|lacks)|of\s+(?:a|the|its)\s+(?:root\s+)?(?:page|noun|topic|subject|label)\b|near\b))/i, written: 'the node a subject holds under an anchor, which an axis reads', by: 'D357' },
  { pattern: /\bmembership\b/i, written: 'a vector or a set holding an element or lacking it, `has`', by: 'D357' },
  { pattern: /\bpaths?[\s-]+of[\s-]+anchors\b/i, written: 'anchors read in turn, a vector of anchors', by: 'D357' },
  { pattern: /\bthe[\s-]+check[\s-]+(?:its|a|the)[\s-]+host[\s-]+hands\b|\bchecks?[\s-]+of[\s-]+(?:a|its|the)[\s-]+hosts?\b/i, written: 'the constructor a host hands a kind of the core, which attaches the tag to a payload or refuses it', by: 'D357' },
  { pattern: /\brecipes?[\s-]+of[\s-]+(?:a|the|its)[\s-]+kinds?\b|\bkinds?[\s-]+takes?[\s-]+no[\s-]+recipe\b|\bkinds?\s+of\s+no\s+recipe\b/i, written: 'the constructor the slot of a kind holds, recipe naming the code of a verb alone', by: 'D357' },
];
