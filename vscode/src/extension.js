// The editor's extension: it launches the language server of the checkout,
// paints a block of qlang in a preview of markdown by the core's tokens and
// selects a word by the regex of a name the core exports, each once the module
// that holds it has loaded [QSHST#tools].
// The rules it holds: [QSWRK#tooling], [QSHST#tools].

const path = require('path');
const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');
const { blockHtml } = require('./markdown-block.js');

let client;

// The core's `tokenize` and the names of the root's words a block is painted
// by, each handed over as it loads [QSHST#tools].
const painter = { tokenize: null, verbNames: new Set() };

function activate(context) {
  const serverModule = path.resolve(__dirname, '..', '..', 'lsp', 'src', 'server.mjs');

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio }
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'qlang' }]
  };

  client = new LanguageClient('qlang', 'qlang Language Server', serverOptions, clientOptions);
  client.start();

  const unloaded = error => console.warn('qlang: the core did not load:', error.message);
  import('@kaluchi/qlang-core/highlight').then(({ tokenize }) => { painter.tokenize = tokenize; }, unloaded);
  import('@kaluchi/qlang-core').then(async ({ langRuntime, verbNames, NAME_REGEX }) => {
    context.subscriptions.push(vscode.languages.setLanguageConfiguration('qlang', { wordPattern: NAME_REGEX }));
    painter.verbNames = verbNames(await langRuntime());
  }).catch(unloaded);

  return {
    extendMarkdownIt(md) {
      const highlightOfAnother = md.options.highlight;
      md.options.highlight = (code, lang, attrs) => {
        if (lang === 'qlang') return blockHtml(code, painter);
        return highlightOfAnother ? highlightOfAnother(code, lang, attrs) : '';
      };
      return md;
    }
  };
}

function deactivate() {
  return client?.stop();
}

module.exports = { activate, deactivate };
