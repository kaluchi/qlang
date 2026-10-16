// The kind [QSBLD#kind]: the constructor of `::kind`, which reads a kind from
// its literal, the commands that declare it folded into data and the check a
// host hands a kind of the core, and the words that build one from the noun by
// commands, each writing its command after the ones the kind holds, the check
// last.

import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindOf } from './signature.mjs';
import { commandStep } from '../quote.mjs';
import {
  isVec, isNull, isBuiltinDescriptor, isKind, commandsOf, recipeOf,
  makeTag, makeTagged, makeQuote, KIND_TAG_NAME
} from '../types.mjs';

const KIND_TAG = makeTag(KIND_TAG_NAME);

const KindPayloadNotPairError = declareRefusal('kind/PayloadNotPairError');
const KindRecipeNotBuiltinError = declareRefusal('kind/RecipeNotBuiltinError');

// A kind of its commands and its recipe, its commands read here, so ones
// that declare no kind are refused where the kind is made.
function madeKind(commands, recipe) {
  const kind = makeTagged(KIND_TAG, Object.freeze([commands, recipe]));
  kindOf(kind);
  return kind;
}

// `::kind[commands check]` — a kind from its literal: the quote of its
// commands, and the check a host hands a kind of the core, or null for a
// kind that attaches its tag by its commands alone [QSLIT#tag].
bindPrim('kind/construct', payload => {
  if (!isVec(payload) || payload.length !== 2) throw new KindPayloadNotPairError({ actualValue: payload });
  const [commands, recipe] = payload;
  if (!(isNull(recipe) || isBuiltinDescriptor(recipe))) throw new KindRecipeNotBuiltinError({ actualValue: recipe });
  return madeKind(commands, recipe);
});

// The kind a builder runs on: a kind, or the noun itself, which starts the
// kind of no commands and no recipe; the call refuses a tag of another noun
// before the builder runs [QSDSP#tagname].
const NO_KIND = madeKind(makeQuote([]), null);

const kindFrom = subject => (isKind(subject) ? subject : NO_KIND);

// A kind with a command written after the ones it holds.
function withCommand(subject, command, objects) {
  const kind = kindFrom(subject);
  return madeKind(makeQuote([...commandsOf(kind), commandStep(command, objects.filter(object => object !== null))]), recipeOf(kind));
}

// `wraps |~~ The sizes. ~~| ::map` — the payload, its page and its kinds.
bindPrim('kind/wraps', (subject, page, kinds) => withCommand(subject, 'wraps', [page, kinds]));

// `reads :w |~~ The width. ~~| /w ::number` — a field of the payload, its
// name, its page, the place of the payload it reads and its kinds.
bindPrim('kind/reads', (subject, name, page, place, kinds) => withCommand(subject, 'reads', [name, page, place, kinds]));

// `tells :values |~~ Values. … ~~| #[::tag ::vec]` — a page of the kind on
// a name, a chapter of a topic among them, and the kinds it tells of.
bindPrim('kind/tells', (subject, name, page, kinds) => withCommand(subject, 'tells', [name, page, kinds]));

// `carries :TooWideError/w |~~ The width. ~~| ::number` — a fact a refusal
// carries, or the payload, its page and its kinds.
bindPrim('kind/carries', (subject, name, page, kinds) => withCommand(subject, 'carries', [name, page, kinds]));

// `holds :TooWideError |~~ … ~~| ~(subOf /h /w | gte 0)` — an invariant
// of the value or of a field: the refusal of one that breaks it, its page
// and its condition.
bindPrim('kind/holds', (subject, name, page, condition) => withCommand(subject, 'holds', [name, page, condition]));

// `throws :w/KindNotTakenError |~~ … ~~|` — a refusal and its page.
bindPrim('kind/throws', (subject, name, page) => withCommand(subject, 'throws', [name, page]));

// `proves :holdsItsSizes |~~ … ~~| ~(…)` — a law of the kind, the claim its
// name makes, its page and the query that proves it.
bindPrim('kind/proves', (subject, name, page, query) => withCommand(subject, 'proves', [name, page, query]));

// `impl ::builtin{}` — the check a host hands a kind of the core, its
// constructor [QSLIT#tag].
bindPrim('kind/impl', (subject, recipe) => madeKind(commandsOf(kindFrom(subject)), recipe));
