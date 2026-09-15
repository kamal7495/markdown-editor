import { EditorView, basicSetup } from "https://esm.sh/codemirror@6.0.1";
import { EditorState, Compartment } from "https://esm.sh/@codemirror/state@6.4.1";
import { markdown } from "https://esm.sh/@codemirror/lang-markdown@6.2.5";
import { languages } from "https://esm.sh/@codemirror/language-data@6.5.1";
import { keymap } from "https://esm.sh/@codemirror/view@6.28.0";
import { indentWithTab } from "https://esm.sh/@codemirror/commands@6.5.0";
import { linter, lintGutter } from "https://esm.sh/@codemirror/lint@6.8.1";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2";

const themeCompartment = new Compartment();

export function createEditor({ parent, doc, onChange, lintSource, isDark }) {
  const extensions = [
    basicSetup,
    keymap.of([indentWithTab]),
    markdown({ codeLanguages: languages }),
    lintGutter(),
    linter(lintSource, { delay: 400 }),
    EditorView.lineWrapping,
    themeCompartment.of(isDark ? [oneDark] : []),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];

  const state = EditorState.create({ doc, extensions });
  const view = new EditorView({ state, parent });
  return view;
}

export function setEditorTheme(view, isDark) {
  view.dispatch({
    effects: themeCompartment.reconfigure(isDark ? [oneDark] : []),
  });
}

export function setEditorDoc(view, text) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

export function getEditorDoc(view) {
  return view.state.doc.toString();
}
