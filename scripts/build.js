import { readFileSync, readdirSync, rmSync, mkdirSync, cpSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './lib/frontmatter.js';
import { parseMarkdown } from './lib/markdown.js';
import { render } from './lib/template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const POSTS_DIR = path.join(ROOT, 'posts');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const CSS_DIR = path.join(ROOT, 'css');
const JS_DIR = path.join(ROOT, 'js');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DIST_DIR = path.join(ROOT, 'dist');

function readTemplate(relativePath) {
  return readFileSync(path.join(TEMPLATES_DIR, relativePath), 'utf-8');
}

function slugify(filename) {
  return filename.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function makeExcerpt(html, description, length = 120) {
  if (description) return description;
  const text = stripTags(html);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function tagsHtml(tags) {
  if (!tags || tags.length === 0) return '';
  return `<ul class="tag-list">${tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul>`;
}

function buildPosts() {
  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const raw = readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data, content } = parseFrontmatter(raw);

    if (!data.title) {
      console.warn(`[build] 경고: ${file} 에 title 프론트매터가 없습니다.`);
    }

    const contentHtml = parseMarkdown(content);
    const slug = slugify(file);
    const date = data.date || '';

    posts.push({
      slug,
      title: data.title || slug,
      date,
      dateDisplay: date ? formatDate(date) : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      description: data.description || '',
      contentHtml,
    });
  }

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

function writePostPages(posts) {
  const template = readTemplate('post.html');
  const headerTemplate = readTemplate('partials/header.html');
  const footerTemplate = readTemplate('partials/footer.html');
  const year = new Date().getFullYear();

  const headerHtml = render(headerTemplate, { homePath: '../index.html' });
  const footerHtml = render(footerTemplate, { year });

  mkdirSync(path.join(DIST_DIR, 'posts'), { recursive: true });

  for (const post of posts) {
    const html = render(template, {
      title: post.title,
      description: makeExcerpt(post.contentHtml, post.description),
      date: post.date,
      dateDisplay: post.dateDisplay,
      tagsHtml: tagsHtml(post.tags),
      content: post.contentHtml,
      cssPath: '../css/style.css',
      jsPath: '../js/theme-toggle.js',
      headerHtml,
      footerHtml,
    });

    writeFileSync(path.join(DIST_DIR, 'posts', `${post.slug}.html`), html, 'utf-8');
  }
}

function writeIndexPage(posts) {
  const template = readTemplate('index.html');
  const headerTemplate = readTemplate('partials/header.html');
  const footerTemplate = readTemplate('partials/footer.html');
  const year = new Date().getFullYear();

  const headerHtml = render(headerTemplate, { homePath: 'index.html' });
  const footerHtml = render(footerTemplate, { year });

  const postListHtml = posts
    .map(
      (post) => `
    <article class="post-card">
      <a href="posts/${post.slug}.html">
        <h2>${post.title}</h2>
      </a>
      <time datetime="${post.date}">${post.dateDisplay}</time>
      <p>${makeExcerpt(post.contentHtml, post.description)}</p>
      ${tagsHtml(post.tags)}
    </article>`
    )
    .join('\n');

  const html = render(template, {
    cssPath: 'css/style.css',
    jsPath: 'js/theme-toggle.js',
    headerHtml,
    footerHtml,
    postListHtml,
  });

  writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf-8');
}

function copyStaticAssets() {
  cpSync(CSS_DIR, path.join(DIST_DIR, 'css'), { recursive: true });
  cpSync(JS_DIR, path.join(DIST_DIR, 'js'), { recursive: true });
  if (existsSync(ASSETS_DIR)) {
    cpSync(ASSETS_DIR, path.join(DIST_DIR, 'assets'), { recursive: true });
  }
}

function build() {
  rmSync(DIST_DIR, { recursive: true, force: true });
  mkdirSync(DIST_DIR, { recursive: true });

  copyStaticAssets();

  const posts = buildPosts();
  writePostPages(posts);
  writeIndexPage(posts);

  console.log(`[build] ${posts.length}개의 글을 빌드했습니다.`);
  for (const post of posts) {
    console.log(`  - dist/posts/${post.slug}.html`);
  }
  console.log('  - dist/index.html');
}

build();
