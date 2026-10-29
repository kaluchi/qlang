// [D491]

export function decodeSemanticTokens(data, types, modifiers = []) {
  const out = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    const dLine = data[i];
    const dChar = data[i + 1];
    line += dLine;
    char = dLine === 0 ? char + dChar : dChar;
    out.push({ line, char, length: data[i + 2], type: types[data[i + 3]], modifiers: modifiers.filter((modifier, bit) => (data[i + 4] & (1 << bit)) !== 0) });
  }
  return out;
}
