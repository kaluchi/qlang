// qlang runtime errors — the category hierarchy, the throw-site
// spec registry, and the per-site declaration over both.
//
// A per-site class names its throw site and nothing else: one site,
// one class. The factories below build them, and each concrete class
// lives next to the site that raises it — an operand impl in
// runtime/*.mjs, a codec seam in codec.mjs, the session envelope in
// session.mjs. `operand-errors.mjs` narrows the same shape for the
// sites that check a slot's value-class, where the operand, the
// position and the expected type spell the diagnostic.
//
// The category roots this file declares:
//
//   QlangError                       — abstract root
//     QlangTypeError                 — abstract typeError class
//     NumericDomainError             — abstract numericDomain class
//     ArityError                     — too many captured args
//     QlangInvariantError            — registration-time invariant
//     EffectLaunderingError          — @-marker laundered past a name
//
// Source-mapping and observability fields on every QlangError:
//   .location       — qlang source position (set by evalNode wrapper
//                     when the error bubbles past an AST node).
//                     Lets editors squiggle the failing operand and
//                     Sentry breadcrumbs cite the qlang source line.
//   .fingerprint    — stable Sentry group key. Equals the per-site
//                     class name; survives minification because it
//                     is a string literal assigned in the constructor,
//                     not a class identifier the bundler can mangle.
//   .schemaVersion  — integer for forward-compat of the error
//                     contract; bumped when fields are added or
//                     renamed so older Sentry consumers can opt out.
//   .toJSON()       — Sentry-safe serialization. Drops `actualValue`
//                     from .context so user PII never lands in the
//                     observability backend.

const ERROR_SCHEMA_VERSION = 1;

// ── Throw-site specs ──────────────────────────────────────────
//
// A per-site error carries four structural facts: the `:category`
// its base names, the `:operand` that raises it, the `:position`
// that operand checks, and the `:expectedType` it requires. Each is
// a property of the throw site, so the site records it here and the
// bootstrap stamps it onto the `::Tag` binding the catalog declares
// under the same name. The catalog carries what an author writes —
// the prose and the `~{…}` examples.
//
// The facts stay plain strings and numbers at this layer; the lift
// into Keywords, TagKeywords and Vecs happens at the stamp site in
// `descriptor-ops.mjs`, which is where the value-class factories
// live. That keeps `errors.mjs` free of a `types.mjs` import, which
// would close a cycle.

const throwSiteSpecs = new Map();

export function recordThrowSiteSpec(className, category, facts = {}) {
  throwSiteSpecs.set(className, Object.freeze({ category, ...facts }));
}

export function throwSiteSpecOf(className) {
  return throwSiteSpecs.get(className);
}

export function throwSiteSpecNames() {
  return throwSiteSpecs.keys();
}

// ── Per-site declaration ───────────────────────────────────────
//
// One throw site, one class. Every per-site class below is built by
// a factory that names it once and records its throw-site spec from
// the same argument, so the class name, the `.kind` the instance
// carries and the `:category` the catalog binding gets stamped with
// cannot drift apart. `operand-errors.mjs` narrows the same shape
// for the four operand slot checks — subject, modifier, element,
// comparability — where the operand and the slot spell the wording
// as well as the spec. The factories here take a message builder
// instead, and cover every site the slot checks leave: a custom
// diagnostic, an arity refusal, a magnitude outside the
// finite-double domain, a runtime invariant, an @-marker laundered
// past a name, a codec seam, the session envelope, the primitive
// registry, the bootstrap.

// `name` is a non-writable own property of a class object, so a
// class built inside a factory reports the factory's local binding
// until redefined. Every per-site class is redefined to its declared
// name, which is what `constructor.name`, a stack frame, and the
// `::Tag` the catalog binds all read.
export function brand(Cls, className) {
  Object.defineProperty(Cls, 'name', { value: className });
  return Cls;
}

// declarePerSiteError — a site whose category names no `instanceof`
// family of its own. The class extends `QlangError` directly and
// stamps `category` as its kind.
export function declarePerSiteError(className, category, buildMessage, facts = {}) {
  recordThrowSiteSpec(className, category, facts);
  const Cls = class extends QlangError {
    constructor(context = {}) {
      super(buildMessage(context), category, context);
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareInvariantError — a registration-time or render-time
// invariant the runtime itself holds. Extends `QlangInvariantError`
// so `evalNode`'s rethrow guard keeps letting it past the deflect
// machinery: an invariant violation is a defect in the runtime or in
// what a host installed, never a value the fail track should carry.
export function declareInvariantError(className, buildMessage, facts = {}) {
  return declareUnder(QlangInvariantError, 'invariantError', className, buildMessage, facts);
}

// declareEffectLaunderingError — a site that caught an @-prefixed
// effect reaching a name that does not carry the marker. Extends
// `EffectLaunderingError` so a host can catch the whole family.
export function declareEffectLaunderingError(className, buildMessage, facts = {}) {
  return declareUnder(EffectLaunderingError, 'effectLaundering', className, buildMessage, facts);
}

// Shared body of every factory whose base already stamps the kind
// and keeps the context bag: the base takes `(message, context)`,
// the per-site class adds its identity.
function declareUnder(BaseError, category, className, buildMessage, facts) {
  recordThrowSiteSpec(className, category, facts);
  const Cls = class extends BaseError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareShapeError — thrown by a site with custom diagnostic
// wording that does not fit the pattern-based factories above.
// The class still carries structured context and a unique site
// name for debugging.
export function declareShapeError(className, buildMessage, facts = {}) {
  recordThrowSiteSpec(className, 'typeError', facts);
  const Cls = class extends QlangTypeError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareNumericDomainError — thrown by a site whose subject and
// modifiers carry the right value-class and whose result leaves the
// finite-double domain a qlang Number lives in. Extends
// `NumericDomainError` so `.kind` reads `numericDomain` and the
// tag-binding's `:category` matches — a shape category would claim
// a type violation the values do not have, since
// `typeKeyword(Infinity)` answers `:number`.
export function declareNumericDomainError(className, buildMessage, facts = {}) {
  recordThrowSiteSpec(className, 'numericDomain', facts);
  const Cls = class extends NumericDomainError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareArityError — thrown by a site whose failure is an
// incorrect captured-arg count (too few, too many, or an unsupported
// specific count). Extends ArityError so `.kind === 'arityError'`
// and `instanceof ArityError` both match, while the concrete
// per-site class still identifies the throw location uniquely.
export function declareArityError(className, buildMessage, facts = {}) {
  recordThrowSiteSpec(className, 'arityError', facts);
  const Cls = class extends ArityError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

export class QlangError extends Error {
  constructor(message, kind, context = {}) {
    super(message);
    this.name = 'QlangError';
    this.kind = kind;
    this.context = context;
    this.location = null;
    this.fingerprint = null;
    this.schemaVersion = ERROR_SCHEMA_VERSION;
  }

  // toJSON() — Sentry-safe serialization. The Sentry SDK calls
  // JSON.stringify on the error during transport, which invokes
  // this method. `context.actualValue` is dropped so user PII
  // (the actual Vec/Map/scalar that triggered the type-check)
  // never lands in the observability backend.
  toJSON() {
    return {
      name: this.name,
      kind: this.kind,
      message: this.message,
      fingerprint: this.fingerprint,
      location: this.location,
      context: Object.fromEntries(
        Object.entries(this.context).filter(([field]) => field !== 'actualValue')
      ),
      schemaVersion: this.schemaVersion
    };
  }
}

export class QlangTypeError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'typeError', context);
    this.name = 'QlangTypeError';
  }
}

export const UnresolvedIdentifierError = declarePerSiteError(
  'UnresolvedIdentifierError', 'unresolvedIdentifier',
  ({ identifierName }) => `unresolved identifier: ${identifierName}`
);

export const DivisionByZeroError = declarePerSiteError(
  'DivisionByZeroError', 'divisionByZero', () => 'division by zero', { operand: 'div' }
);

// NumericDomainError — the value's type is right and its magnitude
// is not. `typeKeyword(Infinity)` answers `:number`, so a shape
// check has nothing to report; what the site refuses is the
// finite-double domain a qlang Number lives in. `DivisionByZeroError`
// is the same family under its own long-standing kind.
export class NumericDomainError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'numericDomain', context);
    this.name = 'NumericDomainError';
  }
}

export class ArityError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'arityError', context);
    this.name = 'ArityError';
  }
}

// EvaluationDepthExceededError — `nestState` (state.mjs) refused one
// more nested evaluation frame past `EVAL_DEPTH_LIMIT`. Kind
// `resourceLimit`: the runaway sits in the query's recursion.
// `context.depth` is the refused frame, `context.limit` the budget.
export const EvaluationDepthExceededError = declarePerSiteError(
  'EvaluationDepthExceededError', 'resourceLimit',
  ({ depth, limit }) => `evaluation depth ${depth} exceeds the budget of ${limit} nested frames`
);

// QlangInvariantError — abstract root for registration-time invariant
// violations raised when a runtime operand is constructed with
// incomplete or malformed metadata. These fire when langRuntime is
// assembled and signal that a runtime-module author forgot to
// provide a required meta field.
// Per-site subclasses live next to the dispatch wrapper that enforces
// the invariant (see runtime/dispatch.mjs).
export class QlangInvariantError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'invariantError', context);
    this.name = 'QlangInvariantError';
  }
}

// EffectLaunderingError — abstract root for the @-prefix effect-marker
// invariant: a BindStep declaration whose body references an
// @-prefixed identifier (the qlang convention for side-effectful host
// operands like @callers, @refs, @hierarchy) must itself be
// @-prefixed, so the effect propagates through every alias. Two
// concrete subclasses fire from two different points:
//
//   EffectLaunderingAtBindStepParseError — fired by `evalBindStep` when
//     the body AST scan (findFirstEffectfulIdentifier) finds an
//     @-prefixed OperandCall or Projection key inside a non-@-
//     prefixed BindStep body.
//
//   EffectLaunderingAtCallError — fired at runtime by
//     eval.mjs::evalOperandCall and eval.mjs::applyConduit
//     when a non-@-prefixed identifier resolves to an effectful
//     function value or conduit (the laundering path where the
//     binding was installed via use, captured via as, or injected
//     by the embedding host, so the eval-time AST scan could not
//     detect the effect).
export class EffectLaunderingError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'effectLaundering', context);
    this.name = 'EffectLaunderingError';
  }
}

export const EffectLaunderingAtBindStepParseError = declareEffectLaunderingError(
  'EffectLaunderingAtBindStepParseError',
  ({ bindingName, effectfulName }) =>
    `binding '${bindingName}' has an effectful body (references '${effectfulName}') ` +
    `but its name is not @-prefixed; rename to '@${bindingName}' or remove the effectful reference`
);

export const EffectLaunderingAtCallError = declareEffectLaunderingError(
  'EffectLaunderingAtCallError',
  ({ bindingName, effectfulName }) =>
    `identifier '${bindingName}' resolved to effectful function '${effectfulName}' ` +
    `but '${bindingName}' is not @-prefixed; the binding was laundered through env, ` +
    `use, or as — rename to '@${bindingName}' to mark the effect`
);
