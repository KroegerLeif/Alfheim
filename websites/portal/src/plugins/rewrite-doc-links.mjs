import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Sätteri mdast plugin that rewrites relative links in the Markdown corpus so they work in the rendered
 * portal while staying valid when the same files are browsed on GitHub.
 *
 * - `./other-page.md#anchor` between documentation pages becomes the portal URL
 *   `<base>/<locale>/<section>/other-page/#anchor`.
 * - Relative links to files or directories elsewhere in the repository (for
 *   example `deploy/stack-apps.yaml`) become absolute GitHub URLs, because the
 *   portal does not serve them.
 *
 * @param {{ base: string, docsDir: string, repoUrl: string, branch?: string }} options
 */
export default function createRewriteDocLinksPlugin(options) {
  const docsDir = realpathSync(options.docsDir);
  const repoRoot = path.dirname(docsDir);
  const base = options.base.replace(/\/$/, '');
  const branch = options.branch ?? 'main';

  /** @param {string} url */
  const isRelative = (url) =>
    url !== '' && !url.startsWith('#') && !url.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(url);

  /** @param {string} target absolute path of the linked file */
  function toPortalUrl(target) {
    const rel = path.relative(docsDir, target).split(path.sep).join('/');
    const match = /^(en|de)\/(.+?)(?:\.mdx?)?$/.exec(rel);
    if (!match) return null;
    const [, locale, slug] = match;
    const parts = slug.toLowerCase().split('/');
    if (parts[parts.length - 1] === 'index') parts.pop();
    return `${base}/${locale}/${parts.join('/')}${parts.length ? '/' : ''}`;
  }

  /** @param {string} target absolute path inside the repository */
  function toRepoUrl(target) {
    const rel = path.relative(repoRoot, target).split(path.sep).join('/');
    const kind = existsSync(target) && statSync(target).isDirectory() ? 'tree' : 'blob';
    return `${options.repoUrl}/${kind}/${branch}/${rel}`;
  }

  /**
   * Computes the replacement for one relative link URL, or null to keep it.
   * @param {string} url
   * @param {string} sourceDir absolute directory of the Markdown file
   */
  function rewrite(url, sourceDir) {
    if (!isRelative(url)) return null;
    const hashAt = url.indexOf('#');
    const rawPath = hashAt === -1 ? url : url.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : url.slice(hashAt);
    if (rawPath === '') return null;
    const target = path.resolve(sourceDir, decodeURI(rawPath));
    if (!target.startsWith(repoRoot + path.sep)) return null;
    if (target.startsWith(docsDir + path.sep) && /\.mdx?$/.test(target)) {
      const portalUrl = toPortalUrl(target);
      return portalUrl ? portalUrl + hash : null;
    }
    return toRepoUrl(target) + hash;
  }

  return {
    name: 'rewrite-doc-links',
    link(node, ctx) {
      if (!ctx.fileURL) return;
      const next = rewrite(node.url, path.dirname(realpathSync(fileURLToPath(ctx.fileURL))));
      if (next) ctx.setProperty(node, 'url', next);
    },
    definition(node, ctx) {
      if (!ctx.fileURL) return;
      const next = rewrite(node.url, path.dirname(realpathSync(fileURLToPath(ctx.fileURL))));
      if (next) ctx.setProperty(node, 'url', next);
    },
  };
}
