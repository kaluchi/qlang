// PEG grammar for the qlang expression language.
//
// Mirrors the Grammar section of docs/jdt-query-lang-spec.md.
//
// Generated parser exports `parse(source)` returning an AST whose
// nodes are JS objects with a discriminator `type` field. Comma is
// optional whitespace; newlines are whitespace.

{{
  // Helpers shared across actions.
  function vec(type, fields) { return { type, ...fields }; }
}}

Query
  = _ p:Pipeline _ { return p; }

Pipeline
  = head:PipeStep tail:(_ Combinator _ PipeStep)*
    { return tail.length === 0
        ? head
        : vec('Pipeline', { steps: [head, ...tail.map(t => ({ combinator: t[1], step: t[3] }))] }); }

Combinator
  = ">>" { return '>>'; }
  / "|"  { return '|'; }
  / "*"  { return '*'; }

PipeStep
  = LetStep
  / AsStep
  / Primary

LetStep
  = "let" __ name:Ident _ "=" _ body:Primary
    { return vec('LetStep', { name, body }); }

AsStep
  = "as" __ name:Ident
    { return vec('AsStep', { name }); }

Primary
  = ParenGroup
  / SetLit
  / VecLit
  / MapLit
  / Projection
  / OperandCall
  / Scalar

ParenGroup
  = "(" _ p:Pipeline _ ")" { return vec('ParenGroup', { pipeline: p }); }

MapLit
  = "{" _ "}" { return vec('MapLit', { entries: [] }); }
  / "{" _ entries:MapEntries _ "}" { return vec('MapLit', { entries }); }

MapEntries
  = head:MapEntry tail:(_ ","? _ MapEntry)*
    { return [head, ...tail.map(t => t[3])]; }

MapEntry
  = key:Keyword __ value:Pipeline
    { return { key, value }; }

SetLit
  = "#{" _ "}" { return vec('SetLit', { elements: [] }); }
  / "#{" _ elements:PipelineList _ "}" { return vec('SetLit', { elements }); }

VecLit
  = "[" _ "]" { return vec('VecLit', { elements: [] }); }
  / "[" _ elements:PipelineList _ "]" { return vec('VecLit', { elements }); }

PipelineList
  = head:Pipeline tail:(_ ","? _ Pipeline)*
    { return [head, ...tail.map(t => t[3])]; }

OperandCall
  = name:Ident !IdentTail args:(_ "(" _ ArgList? _ ")")?
    { return vec('OperandCall', { name, args: args ? (args[3] || []) : null }); }

ArgList
  = head:Pipeline tail:(_ ","? _ Pipeline)*
    { return [head, ...tail.map(t => t[3])]; }

Projection
  = "/" first:Ident rest:("/" Ident)*
    { return vec('Projection', { keys: [first, ...rest.map(r => r[1])] }); }

Scalar
  = StringLit
  / NumberLit
  / BooleanLit
  / NilLit
  / Keyword

StringLit
  = '"' chars:DoubleStringChar* '"'
    { return vec('StringLit', { value: chars.join('') }); }

DoubleStringChar
  = !('"' / "\\") char:. { return char; }
  / "\\" esc:EscapeChar { return esc; }

EscapeChar
  = '"' { return '"'; }
  / "\\" { return "\\"; }
  / "n" { return '\n'; }
  / "t" { return '\t'; }
  / "r" { return '\r'; }

NumberLit
  = sign:"-"? whole:[0-9]+ frac:("." [0-9]+)?
    { const text = (sign || '') + whole.join('') + (frac ? '.' + frac[1].join('') : '');
      return vec('NumberLit', { value: Number(text) }); }

BooleanLit
  = "true"  !IdentTail { return vec('BooleanLit', { value: true }); }
  / "false" !IdentTail { return vec('BooleanLit', { value: false }); }

NilLit
  = "nil" !IdentTail { return vec('NilLit', {}); }

Keyword
  = ":" name:Ident { return vec('Keyword', { name }); }

Ident
  = !ReservedWord first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

ReservedWord
  = ("let" / "as" / "true" / "false" / "nil") !IdentTail

IdentStart = [@_a-zA-Z]
IdentTail  = [a-zA-Z0-9_-]

// Whitespace and comments. `_` is optional whitespace, `__` is
// required whitespace (used to separate Ident from following token).
_  = (Whitespace / LineComment)*
__ = (Whitespace / LineComment)+

Whitespace = [ \t\n\r]
LineComment = "--" [^\n]*
