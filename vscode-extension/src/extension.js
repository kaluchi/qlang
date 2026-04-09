// VS Code extension entry point — starts the qlang language client
// that connects to the LSP server in ../lsp/src/server.mjs.

const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

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
}

function deactivate() {
  return client?.stop();
}

module.exports = { activate, deactivate };
