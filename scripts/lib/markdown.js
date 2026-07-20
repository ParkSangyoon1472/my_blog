const FENCE_RE = /^```/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const BLOCKQUOTE_RE = /^>\s?/;
const UL_ITEM_RE = /^[-*+]\s+/;
const OL_ITEM_RE = /^\d+\.\s+/;

// Wrap code-span placeholders in Private Use Area characters so the index
// digits can never be confused with ordinary numbers in the surrounding text.
const PLACEHOLDER_OPEN = '';
const PLACEHOLDER_CLOSE = '';
const CODE_PLACEHOLDER_RE = new RegExp(`${PLACEHOLDER_OPEN}(\\d+)${PLACEHOLDER_CLOSE}`, 'g');

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseInline(text) {
  let out = escapeHtml(text);

  const codeSnippets = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codeSnippets.push(code);
    return `${PLACEHOLDER_OPEN}${codeSnippets.length - 1}${PLACEHOLDER_CLOSE}`;
  });

  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}">`);
  out = out.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/_(.+?)_/g, '<em>$1</em>');

  out = out.replace(CODE_PLACEHOLDER_RE, (_, idx) => `<code>${codeSnippets[Number(idx)]}</code>`);

  return out;
}

function isBlockStart(line) {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    BLOCKQUOTE_RE.test(line) ||
    UL_ITEM_RE.test(line) ||
    OL_ITEM_RE.test(line)
  );
}

export function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (FENCE_RE.test(line)) {
      i++;
      const codeLines = [];
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      html.push('<hr>');
      i++;
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const quoteLines = [];
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i])) {
        quoteLines.push(lines[i].replace(BLOCKQUOTE_RE, ''));
        i++;
      }
      html.push(`<blockquote><p>${parseInline(quoteLines.join(' '))}</p></blockquote>`);
      continue;
    }

    if (UL_ITEM_RE.test(line)) {
      const items = [];
      while (i < lines.length && UL_ITEM_RE.test(lines[i])) {
        items.push(`<li>${parseInline(lines[i].replace(UL_ITEM_RE, ''))}</li>`);
        i++;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (OL_ITEM_RE.test(line)) {
      const items = [];
      while (i < lines.length && OL_ITEM_RE.test(lines[i])) {
        items.push(`<li>${parseInline(lines[i].replace(OL_ITEM_RE, ''))}</li>`);
        i++;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    html.push(`<p>${parseInline(paraLines.join(' '))}</p>`);
  }

  return html.join('\n');
}
