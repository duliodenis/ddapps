// Deliberately small Markdown subset. Model HTML is always text, never markup.
function element(doc, tag, text) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function inline(parent, text, doc, depth = 0) {
  const pattern = /(`+)([^`\n]+?)\1|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^\n]+?)\*\*|__([^\n]+?)__|\*([^*\n]+?)\*|\bhttps?:\/\/[^\s<>]+/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(doc.createTextNode(text.slice(start, match.index)));
    const [raw, ticks, code, label, href, strong, underscore, emphasis] = match;
    if (ticks) parent.append(element(doc, "code", code));
    else if (label || /^https?:\/\//i.test(raw)) {
      const destination = href || raw;
      // Only explicit HTTP(S) links. No images, embedded HTML, or active schemes.
      if (/^https?:\/\/[^\s<>]+$/i.test(destination)) {
        const link = element(doc, "a", label || raw);
        link.setAttribute("href", destination);
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
        parent.append(link);
      } else parent.append(doc.createTextNode(raw));
    } else {
      const node = element(doc, strong || underscore ? "strong" : "em");
      const content = strong || underscore || emphasis;
      if (depth < 4) inline(node, content, doc, depth + 1);
      else node.textContent = content;
      parent.append(node);
    }
    start = match.index + raw.length;
  }
  parent.append(doc.createTextNode(text.slice(start)));
}

const listItem = (line) => /^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/.exec(line);
const fence = (line) => /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
const heading = (line) => /^#{1,6}\s+(.+)$/.exec(line);
const quote = (line) => /^>\s?(.*)$/.exec(line);

export function renderMarkdown(target, source, doc = document) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const opening = fence(lines[i]);
    if (opening) {
      const code = [];
      i++;
      while (i < lines.length) {
        const closing = fence(lines[i]);
        if (closing && closing[1][0] === opening[1][0] && closing[1].length >= opening[1].length && !closing[2].trim()) { i++; break; }
        code.push(lines[i++]);
      }
      const pre = element(doc, "pre");
      pre.append(element(doc, "code", code.join("\n")));
      blocks.push(pre);
      continue;
    }
    const item = listItem(lines[i]);
    if (item) {
      const ordered = /^\d/.test(item[1]);
      const list = element(doc, ordered ? "ol" : "ul");
      if (ordered) list.setAttribute("start", String(parseInt(item[1], 10)));
      while (i < lines.length) {
        const next = listItem(lines[i]);
        if (!next || /^\d/.test(next[1]) !== ordered) break;
        const li = element(doc, "li");
        inline(li, next[2], doc);
        list.append(li);
        i++;
      }
      blocks.push(list);
      continue;
    }
    const title = heading(lines[i]);
    const quoted = quote(lines[i]);
    if (title || quoted) {
      const node = element(doc, title ? "h4" : "blockquote");
      inline(node, (title || quoted)[1], doc);
      blocks.push(node);
      i++;
      continue;
    }
    const paragraph = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !fence(lines[i]) && !listItem(lines[i]) && !heading(lines[i]) && !quote(lines[i])) paragraph.push(lines[i++]);
    const p = element(doc, "p");
    inline(p, paragraph.join("\n"), doc);
    blocks.push(p);
  }
  target.replaceChildren(...blocks);
}
