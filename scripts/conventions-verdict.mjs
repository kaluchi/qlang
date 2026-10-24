// The verdict of the check of the conventions [QSGAT#gate]: OK where no
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
  forbidden: found => section('Words of a moment and of unfinished work', found, v => `  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet}\n`,
    'a text says what holds, not when it changed, and leaves no word of unfinished work [QSVOX#pentimento].'),
  refusalDeclarations: found => section('Refusals not declared by their address', found, v => `  ${v.file}:${v.line}  ${v.problem}\n`,
    'the address is the key the implementation and the page of the catalog share [QSERR#site].'),
  kindNames: found => section('Refusals that name a kind their address does not', found, v => `  ${v.file}:${v.line}  ${v.address} names ${v.kinds.map(kind => `::${kind}`).join(', ')}\n`,
    'a refusal is public, and a kind its name carries breaks the name when the holder takes another: name it by the role of its holder, `…/ElementKindNotTakenError`, `…/ConditionKindNotTakenError`, the kinds the fact `:expected` [QSERR#site].'),
  proseTallies: found => [`\nDerivable tallies in prose (${found.length}):\n`, ...found.map(v => `  ${v.file}:${v.line}  [tally: '${v.tally}']  ${v.snippet}\n`
    + '    state the invariant and name the generator (npm test / the manifest / the catalog) — the number belongs to the run, not to the prose [QSVOX#pentimento].\n')].join(''),
  workspaceRanges: found => [`\nInternal workspace dependency ranges (${found.length}):\n`, ...found.map(v => `  ${v.file}  ${v.dependencyMap}.${v.depName}: '${v.declaredRange}' — expected '${v.expectedRange}'\n`
    + '    the published manifest carries this range verbatim; name the sibling version this release ships with so a consumer resolves one core instance, not two [QSGAT#workspaces].\n')].join(''),
  anchors: found => section('Anchors the tree no longer holds', found, v => `  ${v.file}  \`${v.anchor}\` ${v.problem}\n`,
    'replace the sentence with the fact of the tree and its new anchor [QSREQ#probe].'),
  catalogDecisions: found => section('Decisions named in the catalog', found, v => `  ${v.file}:${v.line}  ${v.reference}\n`,
    'a page names what a reader can follow by a query; the reason lives with its decision [QSREQ#marks].'),
  undecided: found => section('Records out of their form', found, file => `  ${file}\n`,
    'a record opens with `Domain.`, the part of the work it governs; write `Decided by. The maintainer` or `Decided by. The model`, the line naming the parts of the model beside the choice of the maintainer [QSWRK#journal]; an open record holds `Question.`, `Source.` and `Alternatives.`, and no `Decided by.` or `Decision.` until it is decided [QSWRK#journal].'),
  unmarked: found => section('Artifacts that name no rule they hold', found, path => `  ${path}\n`,
    'name the rules the artifact holds at its head, or let it go [QSREQ#marks].'),
  misplaced: found => section('Records in the wrong folder', found, ({ path, problem }) => `  ${path}  ${problem}\n`,
    'the root of the records holds those in force, and `replaced/` those replaced whole, moved once [QSWRK#journal].'),
  broken: found => section('Links that lead nowhere', found, ({ path, line, target }) => `  ${path}:${line}  ${target}\n`,
    'a link of a document leads to a file the tree holds; `node scripts/replaced-records.mjs` writes the links to a record it moves [QSWRK#journal], [QSREQ#marks].'),
  outOfStep: found => section('Fates out of step', found, ({ name, problem }) => `  ${name}  ${problem}\n`,
    'a line of fate names a record the folder holds, a part taken is named back by the record that took it, and a record is pruned only by one written after it [QSWRK#journal].'),
  unreconciled: found => section('The reconciliation of the tree with its baseline', found, v => `  ${v.where}  ${v.problem}\n`,
    'give each record its fate or its case, cite the records in force and the sections the specification holds or a record in transit brings, and write a chapter at the closeout [QSWRK#reconciliation], [QSVOX#chapter].'),
  intrusions: found => section('A text that states what holds speaks of the change', found, v => `  ${v.file}:${v.line}  [${v.rule}]  ${v.text}\n`,
    'a cataphatic text states what holds; the change, its records and its history belong to the journal [QSVOX#chapter], [QSVOX#voices].'),
  swollen: found => section('Series past their two latest at the baseline', found, ({ name, count, baseline }) => `  ${name}: ${count} at the merge ${baseline} that landed it\n`,
    'a branch keeps every run of its own, and the closeout gives the older to the history, `node scripts/drop-documents.mjs`, git keeping it [QSWRK#closeout].'),
  unread: found => section('Reports of the research without their reading', found, ({ path, reading }) => `  ${path}  wants ${reading}\n`,
    'the session writes its reading beside each report it runs, every finding with its probe and its fate, and commits the two together [QSRVW#research].'),
  takenOutNamed: found => section('Names of what the branch took out', found, ({ file, line, token, snippet }) => `  ${file}:${line}  \`${token}\`  ${snippet}\n`,
    `the code, the catalog and the cases hold none of these since the baseline ${found[0].baseline}: a comment, a doc and the prose name what the reader finds, a section of a chapter waiting for its move under a record in transit over it, and what was lives in the record and the commit [QSVOX#pentimento].`),
  retired: found => section('Words the language retired', found, ({ file, line, word, written, by }) => `  ${file}:${line}  \`${word}\`, which ${by} retired: write ${written}\n`,
    'a word the language retired stays retired in every text that states what holds, and a record that renames a word writes the old one into scripts/retired-words.mjs [QSLEX#term].'),
  // The kinds of the catalog that bear the name of a command of a chain [QSBLD#fn].
  commandKinds: found => section('Kinds that bear the name of a command', found, ({ path, line, name }) => `  ${path}:${line}  ::${name}, the name of the command \`${name}\`\n`,
    'a command of a chain is named by its act and what it writes by the noun of the thing, as `holds` writes an `::invariant` and `proves` a `::law`: the kind takes a noun of its own [QSBLD#fn].'),
  unreadExports: found => section('Exports of the root of the package beyond what a host builds on', found, ({ file, line, name, problem }) => `  ${file}${line === undefined ? '' : `:${line}`}  ${name === undefined ? '' : `\`${name}\` `}${problem}\n`,
    'the root re-exports by name from a module of the core what a workspace beside the core reads from the package or the page of the package writes, each function of the package at one door, and the core reads its own names from their modules [QSGAT#workspaces].'),
  testsOffTheirSection: found => section('Tests that stand at no section of their rule', found, ({ file, line, problem }) => `  ${file}:${line}  ${problem}
`,
    'a test file stands in the section whose rule its tests hold, as a file of the cases does, `cli/test/QSCLI/answer.test.mjs`, cites that section nowhere, groups its tests by two or more in a file of two groups or more, and the title of a test and of a group says the rule in the words of its section, citing none and naming no binding the file imports from the code [QSREQ#marks].'),
  // A comment of the code is a mark [QSLEX#code].
  commentsNoMarks: found => section('Comments that are no marks', found, ({ file, line, snippet }) => `  ${file}:${line}  ${snippet}\n`,
    'a comment of the sources and the tests of the core, the command line and the language server is a mark alone, one line of the citations of the sections and the records its block holds, or a directive of a tool: the code says what it does by its names, a section its rule and a record its reason [QSLEX#code].'),
  // No two modules bear one name [QSLEX#grep].
  sharedNames: found => section('Names two modules bear', found, ({ name, paths }) => `  ${name}  ${paths.join('  ')}\n`,
    'no two modules of the project bear one name, so a search of a name finds one file, a test file, which its section names, and a configuration of a tool aside by their form [QSLEX#grep].')
};
