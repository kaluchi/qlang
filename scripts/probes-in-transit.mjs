// [QSREQ#probe]
//
// The records in transit over a probe of a chapter, over its section or over
// its chapter whole; the one among them that holds a probe of its query, and
// the one that overrides its chapter whole, whose closeout writes the chapter
// anew. A probe whose answer changed waits where either holds it.

export function recordsOverAProbe(transit, chapter, probe, holdsTheQuery) {
  const over = [...transit].filter(([, sections]) => sections.some(cited => cited === chapter || cited === `${chapter}#${probe.section}`)).map(([name]) => name);
  return {
    over,
    holding: over.find(name => holdsTheQuery(name, probe.query)),
    whole: over.find(name => transit.get(name).includes(chapter))
  };
}
