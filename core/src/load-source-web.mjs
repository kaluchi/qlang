// [QSHST#source], [QSWRK#tooling]

import { makeKeyword } from './types.mjs';
import { BuiltinSourceLoadError } from './source-load-error.mjs';

/* global fetch */
export async function loadSource(uri) {
  let url;
  try {
    url = import.meta.resolve(`#${uri}`);
  } catch {
    return null;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new BuiltinSourceLoadError({ origin: makeKeyword(uri), sourceLocation: url, cause: new Error(`HTTP ${res.status}`) });
  }
  return res.text();
}
