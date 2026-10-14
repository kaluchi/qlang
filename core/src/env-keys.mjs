// The sigil of a tag, and the keys no name a reader declares spells: the
// root beneath the scope [D153], the tree of the query a body reads as
// data [QSNAM#owner], the names a call binds in its body's scope
// [QSNAM#scope], and the values of the reader withheld from code held as
// data [D278].
export const TAG_SIGIL = '::';
export const ROOT_KEY = Symbol('qlang/root');
export const QUERY_KEY = Symbol('qlang/query');
export const CALL_BINDS_KEY = Symbol('qlang/call-binds');
export const WITHHELD_KEY = Symbol('qlang/withheld');
