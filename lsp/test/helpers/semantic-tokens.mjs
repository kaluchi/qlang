// [QSLSP#server]

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
