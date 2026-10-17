// The verdict of the check of the conventions [QSWRK#tooling]: OK where no
// check found anything, and otherwise the findings of each check that found
// some, with the rule it holds, the check failing.

// verdictOf(found) → `{ text, failed }`, `found` the findings of each check by
// its name, in the order the text lists them.
export function verdictOf(found) {
  const sections = Object.entries(found).filter(([, findings]) => findings.length > 0).map(([name, findings]) => SECTIONS[name](findings));
  return sections.length === 0 ? { text: 'check:conventions — OK\n', failed: false } : { text: sections.join(''), failed: true };
}

// A section of the text: its title and the count of its findings, each
// finding a line, and the rule the check holds.
const section = (title, found, lineOf, rule) => [`\n${title} (${found.length}):\n`, ...found.map(lineOf), `    ${rule}\n`].join('');

const SECTIONS = {
  forbidden: found => section('Forbidden framing / markers', found, v => `  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet}\n`,
    'a text says what holds, not when it changed, and leaves no marker of work undone [QSWRK#tooling].'),
  refusalDeclarations: found => section('Refusals not declared by their address', found, v => `  ${v.file}:${v.line}  ${v.problem}\n`,
    'the address is the key the implementation and the page of the catalog share [QSERR#site].'),
  proseTallies: found => [`\nDerivable tallies in prose (${found.length}):\n`, ...found.map(v => `  ${v.file}:${v.line}  [tally: '${v.tally}']  ${v.snippet}\n`
    + '    state the invariant and name the generator (npm test / the manifest / the catalog) — the number belongs to the run, not to the prose [QSWRK#tooling].\n')].join(''),
  workspaceRanges: found => [`\nInternal workspace dependency ranges (${found.length}):\n`, ...found.map(v => `  ${v.file}  ${v.dependencyMap}.${v.depName}: '${v.declaredRange}' — expected '${v.expectedRange}'\n`
    + '    the published manifest carries this range verbatim; name the sibling version this release ships with so a consumer resolves one core instance, not two [QSWRK#tooling].\n')].join(''),
  anchors: found => section('Anchors the tree no longer holds', found, v => `  ${v.file}  \`${v.anchor}\` ${v.problem}\n`,
    'replace the sentence with the fact of the tree and its new anchor [QSWRK#probe].'),
  catalogDecisions: found => section('Decisions named in the catalog', found, v => `  ${v.file}:${v.line}  ${v.reference}\n`,
    'a page names what a reader can follow by a query; the reason lives with its decision [QSWRK#marks].'),
  undecided: found => section('Records out of their form', found, file => `  ${file}\n`,
    'a record opens with `Domain.`, the part of the work it governs; write `Decided by. The maintainer` or `Decided by. The model`, the line naming the parts of the model beside the choice of the maintainer [QSWRK#journal]; an open record holds `Question.`, `Source.` and `Alternatives.`, and no `Decided by.` or `Decision.` until it is decided [QSWRK#journal].'),
  unmarked: found => section('Artifacts that name no rule they hold', found, path => `  ${path}\n`,
    'name the rules the artifact holds at its head, or let it go [QSWRK#marks].'),
  misplaced: found => section('Records in the wrong folder', found, ({ path, problem }) => `  ${path}  ${problem}\n`,
    'the root of the records holds those in force, and `replaced/` those replaced whole, moved once [QSWRK#journal].'),
  broken: found => section('Links that lead nowhere', found, ({ path, line, target }) => `  ${path}:${line}  ${target}\n`,
    'a link of a document leads to a file the tree holds; `node scripts/replaced-records.mjs` writes the links to a record it moves [QSWRK#journal], [QSWRK#marks].'),
  outOfStep: found => section('Fates out of step', found, ({ name, problem }) => `  ${name}  ${problem}\n`,
    'a line of fate names a record the folder holds, a part taken is named back by the record that took it, and a record is pruned only by one written after it [QSWRK#journal].'),
  unwalked: found => section('The walk of the baseline', found, v => `  ${v.where}  ${v.problem}\n`,
    'give each record its fate or its case, move the baseline, and cite the records in force [QSWRK#baseline].'),
  intrusions: found => section('A text that states what holds speaks of the change', found, v => `  ${v.file}:${v.line}  [${v.rule}]  ${v.text}\n`,
    'a cataphatic text states what holds; the change, its records and its history belong to the journal [QSWRK#spec], [QSWRK#documents].'),
  swollen: found => section('Series past their two latest at the baseline', found, ({ name, count, baseline }) => `  ${name}: ${count} at the merge ${baseline} that landed it\n`,
    'a branch keeps every run of its own, and the move of the baseline gives the older to the history, `node scripts/drop-documents.mjs`, git keeping it [QSWRK#baseline].'),
  unread: found => section('Reports of the research without their reading', found, ({ path, reading }) => `  ${path}  wants ${reading}\n`,
    'the session writes its reading beside each report it runs, every finding with its probe and its fate, and commits the two together [QSWRK#review].'),
  takenOutNamed: found => section('Names of what the branch took out', found, ({ file, line, token, snippet }) => `  ${file}:${line}  \`${token}\`  ${snippet}\n`,
    `the code, the catalog and the cases hold none of these since the baseline ${found[0].baseline}: a comment, a doc and the prose name what the reader finds, a section of a chapter waiting for its move under a record in transit over it, and what was lives in the record and the commit [QSWRK#documents].`),
  retired: found => section('Words the language retired', found, ({ file, line, word, written, by }) => `  ${file}:${line}  \`${word}\`, which ${by} retired: write ${written}\n`,
    'a word the language retired stays retired in every text that states what holds, and a record that renames a word writes the old one into scripts/retired-words.mjs [QSWRK#documents].'),
  // The kinds of the catalog that bear the name of a command of a chain [QSBLD#fn].
  commandKinds: found => section('Kinds that bear the name of a command', found, ({ path, line, name }) => `  ${path}:${line}  ::${name}, the name of the command \`${name}\`\n`,
    'a command of a chain is named by its act and what it writes by the noun of the thing, as `holds` writes an `::invariant` and `proves` a `::law`: the kind takes a noun of its own [QSBLD#fn].')
};
