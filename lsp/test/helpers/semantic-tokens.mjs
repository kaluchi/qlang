// The semantic tokens the server answers, decoded from the run of their
// five integers to the line, the column, the length and the type of each
// [QSLSP#server].

// Helper: decode the LSP 5-int semantic-tokens stream into
// `{ line, char, length, type }` records that align back to source
// offsets, so assertions can read the token kinds without
// reproducing the delta-encoding rules.
export function decodeSemanticTokens(data, types) {
  const out = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    const dLine = data[i];
    const dChar = data[i + 1];
    line += dLine;
    char = dLine === 0 ? char + dChar : dChar;
    out.push({ line, char, length: data[i + 2], type: types[data[i + 3]] });
  }
  return out;
}
