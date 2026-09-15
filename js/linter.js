import { unified } from "https://esm.sh/unified@11.0.4";
import remarkParse from "https://esm.sh/remark-parse@11.0.0";
import remarkGfm from "https://esm.sh/remark-gfm@4.0.0";
import remarkFrontmatter from "https://esm.sh/remark-frontmatter@5.0.0";
import remarkPresetLintRecommended from "https://esm.sh/remark-preset-lint-recommended@7.0.0";
import remarkPresetLintConsistent from "https://esm.sh/remark-preset-lint-consistent@6.0.0";
import remarkLintFinalNewline from "https://esm.sh/remark-lint-final-newline@3.0.0";
import remarkLintNoDuplicateHeadings from "https://esm.sh/remark-lint-no-duplicate-headings@4.0.0";
import remarkLintNoUndefinedReferences from "https://esm.sh/remark-lint-no-undefined-references@5.0.0";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkPresetLintRecommended)
  .use(remarkPresetLintConsistent)
  .use(remarkLintFinalNewline)
  .use(remarkLintNoDuplicateHeadings)
  .use(remarkLintNoUndefinedReferences);

/**
 * @param {string} text
 * @returns {Promise<Array<{line:number, column:number, endLine:number, endColumn:number, message:string, severity:'error'|'warning'|'info', ruleId:string}>>}
 */
export async function lintMarkdown(text) {
  const file = await processor.process(text);
  return file.messages.map((msg) => {
    const start = msg.place?.start ?? msg.position?.start ?? { line: 1, column: 1 };
    const end = msg.place?.end ?? msg.position?.end ?? start;
    return {
      line: start.line ?? 1,
      column: start.column ?? 1,
      endLine: end.line ?? start.line ?? 1,
      endColumn: end.column ?? (start.column ?? 1) + 1,
      message: msg.reason,
      severity: msg.fatal === true ? "error" : msg.fatal === false ? "warning" : "info",
      ruleId: msg.ruleId || msg.source || "",
    };
  });
}
