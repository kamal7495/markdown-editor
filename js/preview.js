import { unified } from "https://esm.sh/unified@11.0.4";
import remarkParse from "https://esm.sh/remark-parse@11.0.0";
import remarkGfm from "https://esm.sh/remark-gfm@4.0.0";
import remarkFrontmatter from "https://esm.sh/remark-frontmatter@5.0.0";
import remarkRehype from "https://esm.sh/remark-rehype@11.1.0";
import rehypeHighlight from "https://esm.sh/rehype-highlight@7.0.0";
import rehypeSanitize, { defaultSchema } from "https://esm.sh/rehype-sanitize@6.0.0";
import rehypeStringify from "https://esm.sh/rehype-stringify@10.0.0";

const schema = structuredClone(defaultSchema);
schema.attributes["*"] = [...(schema.attributes["*"] || []), "className"];
schema.attributes.input = ["type", "checked", "disabled"];
if (!schema.tagNames.includes("span")) schema.tagNames.push("span");

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeHighlight, { ignoreMissing: true })
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

export async function renderMarkdown(text) {
  const file = await processor.process(text);
  return String(file);
}
