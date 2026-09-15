import { EditorView, basicSetup } from "https://esm.sh/codemirror@6.0.1";
import { EditorState, EditorSelection, Compartment } from "https://esm.sh/@codemirror/state@6.4.1";
import { markdown } from "https://esm.sh/@codemirror/lang-markdown@6.2.5";
import { languages } from "https://esm.sh/@codemirror/language-data@6.5.1";
import { keymap } from "https://esm.sh/@codemirror/view@6.28.0";
import { indentWithTab } from "https://esm.sh/@codemirror/commands@6.5.0";
import { linter, lintGutter } from "https://esm.sh/@codemirror/lint@6.8.1";
import { search, searchKeymap } from "https://esm.sh/@codemirror/search@6.5.6";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2";

export { EditorState, EditorSelection, EditorView };

const themeCompartment = new Compartment();

let _onChange = () => {};
let _lintSource = () => [];

/** Must be called once before creating any tab states. */
export function configureEditor({ onChange, lintSource }) {
  _onChange = onChange;
  _lintSource = lintSource;
}

function buildExtensions(isDark) {
  return [
    basicSetup,
    keymap.of([
      indentWithTab,
      { key: "Mod-b", run: (v) => runFormatting("bold", v), preventDefault: true },
      { key: "Mod-i", run: (v) => runFormatting("italic", v), preventDefault: true },
      { key: "Mod-k", run: (v) => runFormatting("link", v), preventDefault: true },
      { key: "Mod-Shift-8", run: (v) => runFormatting("list", v), preventDefault: true },
      ...searchKeymap,
    ]),
    markdown({ codeLanguages: languages }),
    search({ top: true }),
    lintGutter(),
    linter((v) => _lintSource(v), { delay: 400 }),
    EditorView.lineWrapping,
    themeCompartment.of(isDark ? [oneDark] : []),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) _onChange(update.state.doc.toString());
    }),
  ];
}

// Formatting commands live in formatting.js but are wired into the keymap
// here to avoid a circular import; this indirection just forwards the call.
let _formattingCommands = {};
export function registerFormattingCommands(commands) {
  _formattingCommands = commands;
}
function runFormatting(name, view) {
  const fn = _formattingCommands[name];
  return fn ? fn(view) : false;
}

/** @returns {EditorState} */
export function createTabState(doc, isDark) {
  return EditorState.create({ doc, extensions: buildExtensions(isDark) });
}

export function createEditorView(parent, initialState) {
  return new EditorView({ state: initialState, parent });
}

export function setEditorTheme(view, isDark) {
  view.dispatch({
    effects: themeCompartment.reconfigure(isDark ? [oneDark] : []),
  });
}
