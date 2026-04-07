// qlang runtime errors.
//
// The hierarchy splits errors by WHERE they fire, not just WHAT
// kind they are. Every error derives from QlangError and carries
// a `kind` tag for coarse matching plus a specific class name and
// structured `context` fields for precise diagnostics.
//
//   QlangError                        — abstract root
//     QlangTypeError                  — abstract type-error class
//       SubjectTypeError              — operand got wrong subject
//       ModifierTypeError             — captured arg has wrong type
//       ElementTypeError              — collection element wrong type
//       ComparabilityError            — ordering across incompatible scalars
//       ProjectionError               — /key on non-Map
//       CombinatorError               — *, >> on non-Vec
//       ApplicationError              — calling a non-function with args
//     UnresolvedIdentifierError       — identifier not in env
//     DivisionByZeroError             — div(_, 0)
//     ArityError                      — too many captured args

export class QlangError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'QlangError';
    this.kind = kind;
  }
}

// ── Type errors ────────────────────────────────────────────────

export class QlangTypeError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'type-error');
    this.name = 'QlangTypeError';
    this.context = context;
  }
}

export class SubjectTypeError extends QlangTypeError {
  constructor(operand, expectedType, actualType, actualValue) {
    super(
      `${operand} requires ${expectedType} subject, got ${actualType}`,
      { operand, expectedType, actualType, actualValue }
    );
    this.name = 'SubjectTypeError';
  }
}

export class ModifierTypeError extends QlangTypeError {
  constructor(operand, position, expectedType, actualType) {
    super(
      `${operand} expects ${expectedType} at position ${position}, got ${actualType}`,
      { operand, position, expectedType, actualType }
    );
    this.name = 'ModifierTypeError';
  }
}

export class ElementTypeError extends QlangTypeError {
  constructor(operand, index, expectedType, actualType) {
    super(
      `${operand}: element ${index} expects ${expectedType}, got ${actualType}`,
      { operand, index, expectedType, actualType }
    );
    this.name = 'ElementTypeError';
  }
}

export class ComparabilityError extends QlangTypeError {
  constructor(operand, leftType, rightType) {
    super(
      `${operand} cannot compare ${leftType} with ${rightType}`,
      { operand, leftType, rightType }
    );
    this.name = 'ComparabilityError';
  }
}

export class ProjectionError extends QlangTypeError {
  constructor(key, actualType) {
    super(
      `/${key} requires Map subject, got ${actualType}`,
      { key, actualType }
    );
    this.name = 'ProjectionError';
  }
}

export class CombinatorError extends QlangTypeError {
  constructor(combinator, expectedType, actualType) {
    super(
      `${combinator} requires ${expectedType} pipeValue, got ${actualType}`,
      { combinator, expectedType, actualType }
    );
    this.name = 'CombinatorError';
  }
}

export class ApplicationError extends QlangTypeError {
  constructor(name, actualType) {
    super(
      `cannot apply arguments to ${name}: resolves to ${actualType}, not a function`,
      { name, actualType }
    );
    this.name = 'ApplicationError';
  }
}

// ── Non-type errors ────────────────────────────────────────────

export class UnresolvedIdentifierError extends QlangError {
  constructor(name) {
    super(`unresolved identifier: ${name}`, 'unresolved-identifier');
    this.name = 'UnresolvedIdentifierError';
    this.identifierName = name;
  }
}

export class DivisionByZeroError extends QlangError {
  constructor() {
    super('division by zero', 'division-by-zero');
    this.name = 'DivisionByZeroError';
  }
}

export class ArityError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'arity-error');
    this.name = 'ArityError';
    this.context = context;
  }
}
