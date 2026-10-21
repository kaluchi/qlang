# QSLSP · The language server and the editor

What the language server reads from the core and answers an editor, and
how the extension of the editor shows a source of qlang. The tests of
`lsp/` and `vscode/` hold its sections; the tokens they coat are
[QSHST#tokens].

## server

The language server runs over stdio and reads the language from the core:
the walks of the parts, the kinds of a value, the tokens of `tokenize`,
the pages by `doc | prose`, and the grammar, which reads the steps before
the cursor, a step the server writes at the cursor and drops before the
steps run, and what stands as whitespace there, a comment among it; the
characters it asks a completion and the help of a signature at are its
own. It prints no answer, and coats the tokens of `tokenize` by a type of
semantic token, a bracket and a gap by none [QSHST#tokens].

```sh
$ git grep -c -F "triggerCharacters: [" -- lsp/src/server.mjs
lsp/src/server.mjs:2
```

## reach

The names the server reaches at a place, which its hover, its
goto-definition and its completion read, are the declarations visible
there across the groups and the quotes around it [QSNAM#scope], and inside
the body of a verb, of the declarations outside it, the verbs, the nodes
and the labels of the pipelines that hold the verb wherever they stand, the
verb itself among them, and no value a reader named there: a reading of the
text alone, which reaches a node declared after the last call of the verb,
where the language refuses the name, and misses one declared in a group
around a call [QSNAM#verb]. A name the document declares nowhere goes to
the catalog by the reach of a bare name [QSNAM#reach]. A verb of the root
shows the inputs of its function and the prose of its page,
`doc | prose`, and a reader's name the prose of the docs of its
declaration.

## offer

After a step the server offers the verbs that serve the value the step
answers as far as it knows the value: the value of a literal, which it runs
alone over the root, and after a call the kinds of the answer as the
evaluator lays it, the walk of the subject through the verb's own label and
the kind `::tagged` of the value it reached, where `returns` names that
label and the walk reached it, the kinds beneath it, which the answer laid
back may change, and the noun a tag name names left out, with the other
kinds `returns` names beside them, and elsewhere the kinds `returns` names;
the walk of a tag name passes the noun it names, whose verbs serve it only
where their `on` names `::tag` [QSDSP#tagname], and where the server knows
no kind it offers every name:

```qlang
> get [~(::Box[1 2] | within ~(get /0) | payload | type) ~(::Box[1 2] | payload | type)]
[::number ::vec]
```

## symbols

A fold ends on the line where its last part ends, a doc's where its text
ends, and the server names a declaration by its role, a verb, a value a
reader named or a label, read from the form its source writes, a body that
opens with `::kind` a label and a body that runs on the values of its label
a verb, and no document run to name them, so a kind built elsewhere and
bound by name is a kind to the runtime and a value to the tools:

```qlang
> :K (::kind | wraps |~~ x ~~| ::map) | :Box |~~ A box. ~~| K | get [~(::Box{:a 1} | type) ~(::Box#5 !| type) ~(kinds | has ::Box)]
[::Box ::Box/PayloadKindNotTakenError true]
```

## extension

The extension of the editor, which launches the language server of the
checkout, paints a block of qlang in a preview of markdown by the tokens of
`tokenize`, plain until the core's painter loads and every call a name
until the root hands over the names of its words, each kind coated by a
class of highlight.js and a token inside a quote leaning; a block that
holds a prompt, `> `, is the queries after its prompts, each with the
indented lines that follow it, and the answers below them. It selects a
word by the regex of a name the core exports [QSNAM#letters], and its
configuration of the language writes neither the regex of a word nor the
markers of a fold, which the core and the server answer.
