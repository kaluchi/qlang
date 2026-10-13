// The kind [D252]: the constructor of `::kind`, which reads a kind from its
// literal, the commands that declare it folded into data and the recipe
// that builds its values, and the words that build one from the noun by
// commands, each writing its command after the ones the kind holds, the
// recipe last.

import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindOf } from './signature.mjs';
import { commandStep } from '../quote.mjs';
import {
  isVec, isNull, isBuiltinDescriptor, isKind, commandsOf, recipeOf,
  makeTag, makeTaggedInstance, makeQuote, KIND_TAG_NAME
} from '../types.mjs';

const KIND_TAG = makeTag(KIND_TAG_NAME);

const KindPayloadNotPairError = declareRefusal('kind/PayloadNotPairError');
const KindRecipeNotBuiltinError = declareRefusal('kind/RecipeNotBuiltinError');
const KindWrapsSubjectNotKindError = declareRefusal('kind/wraps/SubjectNotKindError');
const KindReadsSubjectNotKindError = declareRefusal('kind/reads/SubjectNotKindError');
const KindTellsSubjectNotKindError = declareRefusal('kind/tells/SubjectNotKindError');
const KindCarriesSubjectNotKindError = declareRefusal('kind/carries/SubjectNotKindError');
const KindHoldsSubjectNotKindError = declareRefusal('kind/holds/SubjectNotKindError');
const KindThrowsSubjectNotKindError = declareRefusal('kind/throws/SubjectNotKindError');
const KindProvesSubjectNotKindError = declareRefusal('kind/proves/SubjectNotKindError');
const KindImplSubjectNotKindError = declareRefusal('kind/impl/SubjectNotKindError');

// A kind of its commands and its recipe, its commands read here, so ones
// that declare no kind are refused where the kind is made.
function madeKind(commands, recipe) {
  const kind = makeTaggedInstance(KIND_TAG, Object.freeze([commands, recipe]));
  kindOf(kind);
  return kind;
}

// `::kind[commands check]` — a kind from its literal: the quote of its
// commands, and the check a host hands a kind of the core, or null for a
// kind that attaches its tag by its commands alone [D279].
bindPrim('kind/construct', payload => {
  if (!isVec(payload) || payload.length !== 2) throw new KindPayloadNotPairError({ actualValue: payload });
  const [commands, recipe] = payload;
  if (!(isNull(recipe) || isBuiltinDescriptor(recipe))) throw new KindRecipeNotBuiltinError({ actualValue: recipe });
  return madeKind(commands, recipe);
});

// The kind a builder runs on: a kind, or the noun itself, which starts the
// kind of no commands and no recipe; a tag of another noun, which the
// builder's subject takes beside the kind, is refused.
const NO_KIND = madeKind(makeQuote([]), null);

function kindFrom(subject, SubjectError) {
  if (isKind(subject)) return subject;
  if (subject.name !== KIND_TAG_NAME) throw new SubjectError({ actualValue: subject });
  return NO_KIND;
}

// A kind with a command written after the ones it holds.
function withCommand(subject, SubjectError, command, objects) {
  const kind = kindFrom(subject, SubjectError);
  return madeKind(makeQuote([...commandsOf(kind), commandStep(command, objects.filter(object => object !== null))]), recipeOf(kind));
}

// `wraps |~~ The sizes. ~~| ::map` — the payload, its page and its kinds.
bindPrim('kind/wraps', (subject, page, kinds) => withCommand(subject, KindWrapsSubjectNotKindError, 'wraps', [page, kinds]));

// `reads :w |~~ The width. ~~| /w ::number` — a field of the payload, its
// name, its page, the place of the payload it reads and its kinds.
bindPrim('kind/reads', (subject, name, page, place, kinds) => withCommand(subject, KindReadsSubjectNotKindError, 'reads', [name, page, place, kinds]));

// `tells :values |~~ Values. … ~~| #[::tag ::vec]` — a page of the kind on
// a name, a chapter of a topic among them, and the kinds it tells of.
bindPrim('kind/tells', (subject, name, page, kinds) => withCommand(subject, KindTellsSubjectNotKindError, 'tells', [name, page, kinds]));

// `carries :TooWideError/w |~~ The width. ~~| ::number` — a fact a refusal
// carries, or the payload, its page and its kinds.
bindPrim('kind/carries', (subject, name, page, kinds) => withCommand(subject, KindCarriesSubjectNotKindError, 'carries', [name, page, kinds]));

// `holds :TooWideError |~~ … ~~| ~(subOf /h /w | gte 0)` — an invariant
// of the value or of a field: the refusal of one that breaks it, its page
// and its condition.
bindPrim('kind/holds', (subject, name, page, condition) => withCommand(subject, KindHoldsSubjectNotKindError, 'holds', [name, page, condition]));

// `throws :w/NotNumberError |~~ … ~~|` — a refusal and its page.
bindPrim('kind/throws', (subject, name, page) => withCommand(subject, KindThrowsSubjectNotKindError, 'throws', [name, page]));

// `proves :holdsItsSizes |~~ … ~~| ~(…)` — a law of the kind, the claim its
// name makes, its page and the query that proves it.
bindPrim('kind/proves', (subject, name, page, query) => withCommand(subject, KindProvesSubjectNotKindError, 'proves', [name, page, query]));

// `impl ::builtin{}` — the check a host hands a kind of the core, its
// constructor [D279].
bindPrim('kind/impl', (subject, recipe) => madeKind(commandsOf(kindFrom(subject, KindImplSubjectNotKindError)), recipe));
