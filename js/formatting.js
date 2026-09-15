import { EditorSelection } from "./editor.js";

function wrapSelection(view, before, after = before) {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to);
    const insert = `${before}${selected}${after}`;
    const from = range.from + before.length;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: selected
        ? EditorSelection.range(from, from + selected.length)
        : EditorSelection.cursor(from),
    };
  });
  view.dispatch(state.update(changes, { scrollIntoView: true }));
  view.focus();
  return true;
}

export function toggleBold(view) {
  return wrapSelection(view, "**");
}

export function toggleItalic(view) {
  return wrapSelection(view, "_");
}

export function insertLink(view) {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to) || "text";
    const insert = `[${selected}](url)`;
    const urlStart = range.from + selected.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 3),
    };
  });
  view.dispatch(state.update(changes, { scrollIntoView: true }));
  view.focus();
  return true;
}

export function toggleList(view) {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(Math.max(range.to, range.from)).number;
    const lineChanges = [];
    for (let ln = startLine; ln <= endLine; ln++) {
      const line = state.doc.line(ln);
      const match = /^(\s*)-\s/.exec(line.text);
      if (match) {
        lineChanges.push({ from: line.from, to: line.from + match[0].length, insert: "" });
      } else {
        lineChanges.push({ from: line.from, insert: "- " });
      }
    }
    return { changes: lineChanges, range };
  });
  view.dispatch(state.update(changes, { scrollIntoView: true }));
  view.focus();
  return true;
}

export const formattingCommands = {
  bold: toggleBold,
  italic: toggleItalic,
  link: insertLink,
  list: toggleList,
};
