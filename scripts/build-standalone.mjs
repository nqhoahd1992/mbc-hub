/**
 * Folds the build into a single HTML file that opens straight from disk.
 *
 * A browser treats every file:// URL as its own opaque origin, so it refuses to
 * fetch the external module and stylesheet the normal build links to - which is
 * why double-clicking dist/index.html shows CORS errors and a blank page. An
 * inline module is never fetched, so inlining everything sidesteps that rule
 * without weakening it.
 *
 * This file is for previewing, emailing or carrying on a USB stick. Deploy the
 * dist folder to the host as usual - separate files cache far better.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const out = join(process.cwd(), 'mbc-hub-standalone.html');

let html = await readFile(join(dist, 'index.html'), 'utf8');

// Take the filenames from the page itself. Reading the assets folder instead
// would happily pick up a leftover bundle from an earlier build, and the result
// looks perfectly fine right up until someone opens it.
const jsName = html.match(/<script type="module"[^>]*src="[^"]*\/([^/"]+\.js)"/)?.[1];
const cssName = html.match(/<link rel="stylesheet"[^>]*href="[^"]*\/([^/"]+\.css)"/)?.[1];

if (!jsName || !cssName) {
  throw new Error('dist/index.html links no script or stylesheet - run `npm run build` first');
}

const js = await readFile(join(dist, 'assets', jsName), 'utf8');
const css = await readFile(join(dist, 'assets', cssName), 'utf8');
const favicon = await readFile(join(dist, 'favicon.svg'), 'utf8');

// A literal closing script tag inside the code would end the inline block early.
const safeJs = js.replaceAll('</script', '<\\/script');

/**
 * Every file folded in here goes in through a replacer FUNCTION, never as a
 * replacement string.
 *
 * A replacement string is scanned for $&, $1, $` and $', and minified code is
 * full of them: one `!==$&&` in the bundle is enough to paste the matched tag
 * into the middle of an expression. The build still reports success, the file
 * is still the right size, and the only symptom is a blank page. A function is
 * handed back verbatim.
 */
const verbatim = (text) => () => text;

html = html.replace(/\s*<script type="module"[^>]*src="[^"]*"><\/script>/, '');
html = html.replace(
  /\s*<link rel="stylesheet"[^>]*href="[^"]*">/,
  verbatim(`\n    <style>\n${css}\n    </style>`),
);
html = html.replace(
  /<link rel="icon"[^>]*>/,
  verbatim(
    `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(
      favicon,
    ).toString('base64')}" />`,
  ),
);
// The whole point is that nothing is fetched. Check before the code goes in:
// the bundle is full of strings that look like markup, and scanning those would
// only produce false alarms.
const leftovers = [...html.matchAll(/(?:src|href)="(?!data:)([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => !/^https?:/.test(url));

if (leftovers.length > 0) {
  throw new Error(`standalone file still references external resources: ${leftovers.join(', ')}`);
}

html = html.replace(
  '</body>',
  verbatim(`  <script type="module">\n${safeJs}\n  </script>\n  </body>`),
);

// A bundle that arrived altered looks perfectly healthy from the outside -
// right tags, near enough the right size - and the only symptom is a blank
// page. Cheaper to assert it went in whole than to find that out by opening it.
if (!html.includes(safeJs)) {
  throw new Error('the bundle was altered on its way into the page - see verbatim() above');
}

await writeFile(out, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`mbc-hub-standalone.html  ${kb} kB  (one file, opens straight from disk)`);
