/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/webLayout.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { webPageWidth, webSpaceColumns, WEB_SIDEBAR_WIDTH, WEB_DOCK_BREAKPOINT } = exportsObject;

// A docked sidebar must leave usable content space at its smallest breakpoint.
assert.ok(WEB_DOCK_BREAKPOINT - WEB_SIDEBAR_WIDTH - 40 >= 600);
for (const route of ['/dashboard', '/profile', '/agenda', '/grades', '/spaces/new', '/spaces/edit/123', '/spaces/123', '/chats/123']) {
  assert.ok(webPageWidth(route) >= 640 && webPageWidth(route) <= 1120, route);
}
assert.ok(webPageWidth('/profile') < webPageWidth('/dashboard'));
assert.ok(webPageWidth('/spaces/new') < webPageWidth('/spaces/123'));
assert.ok(webPageWidth('/agenda') <= 800);

// Check every grid width, including before measurement and breakpoint edges:
// no division by zero, overlap, dropped items, or partial last-row overflow.
for (let width = 0; width <= 2000; width++) {
  const columns = webSpaceColumns(width);
  assert.ok(Number.isInteger(columns) && columns >= 1 && columns <= 4);
  if (width < 228) assert.equal(columns, 1);
  const cell = (width + 12) / columns;
  assert.ok((columns - 1) * cell + cell - 12 <= width + 0.001);
  for (const count of [1, 2, 5, 14]) {
    const positions = new Set();
    for (let index = 0; index < count; index++) {
      const row = Math.floor(index / columns);
      const col = index % columns;
      assert.ok(row < Math.ceil(count / columns));
      positions.add(`${row},${col}`);
    }
    assert.equal(positions.size, count);
  }
}
console.log('PASS: page widths, sidebar breakpoint and responsive grid boundaries (0–2000px).');
