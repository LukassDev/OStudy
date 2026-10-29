/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadTs(file) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  const localRequire = (specifier) => specifier.startsWith('.') ? loadTs(path.join(path.dirname(file), specifier + '.ts')) : require(specifier);
  new Function('exports', 'require', 'module', output)(mod.exports, localRequire, mod);
  return mod.exports;
}
const { getSwipedTab, isHorizontalSwipe, SPACE_TAB_ORDER } = loadTs('src/utils/swipeNavigation.ts');
assert.equal(isHorizontalSwipe(80, 5), true);
assert.equal(isHorizontalSwipe(-80, 5), true);
assert.equal(isHorizontalSwipe(10, 80), false, 'Vertical scrolling must not switch tabs');
assert.equal(isHorizontalSwipe(40, 35), false, 'Diagonal scrolling must not claim the gesture');
assert.equal(isHorizontalSwipe(8, 2), false, 'Taps must remain taps');
assert.equal(isHorizontalSwipe(80, 5, 2), false, 'Multi-touch must not navigate');
for (const [index, tab] of SPACE_TAB_ORDER.entries()) {
  assert.equal(getSwipedTab(tab, -80), SPACE_TAB_ORDER[Math.min(5, index + 1)]);
  assert.equal(getSwipedTab(tab, 80), SPACE_TAB_ORDER[Math.max(0, index - 1)]);
  assert.equal(getSwipedTab(tab, 20), tab, 'Short drags must not navigate');
}
const { SPACE_ICONS } = loadTs('src/utils/spaceIcons.ts');
assert.equal(new Set(SPACE_ICONS).size, SPACE_ICONS.length);
assert.equal(SPACE_ICONS.length, 28);
for (const icon of SPACE_ICONS) {
  if (icon.startsWith('subject:')) {
    assert.ok(fs.existsSync(path.join(root, 'assets/icons/spaces', icon.slice(8) + '.svg')), icon);
  } else {
    const ionicons = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
    assert.ok(icon in ionicons, icon);
  }
}
const { LORELEI_AVATARS } = loadTs('src/utils/loreleiAvatars.ts');
assert.equal(Object.keys(LORELEI_AVATARS).length, 14);
for (const [id, svg] of Object.entries(LORELEI_AVATARS)) {
  assert.equal(svg.replace(/\r\n/g, '\n'), fs.readFileSync(path.join(root, 'assets/avatars', id + '.svg'), 'utf8').replace(/\r\n/g, '\n'));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  const ids = new Set(Array.from(svg.matchAll(/ id="([^"]+)"/g), (match) => match[1]));
  for (const match of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g)) assert.ok(ids.has(match[1]), 'Missing SVG reference: ' + match[1]);
}
const { AVATAR_PRESETS, AVATAR_BACKGROUND, getAvatarPreset, isInitialsAvatar } = loadTs('src/utils/avatarPresets.ts');
assert.equal(AVATAR_PRESETS.length, 14);
assert.equal(AVATAR_BACKGROUND, '#f4f1ea');
assert.equal(isInitialsAvatar('initials'), true);
assert.ok(AVATAR_PRESETS.every((preset) => !preset.id.startsWith('geo-')));
for (const id of ['geo-1', 'geo-2', 'geo-3', 'geo-5']) assert.ok(getAvatarPreset(id).id in LORELEI_AVATARS);
console.log('PASS: swipe directions, tab boundaries, vertical/multi-touch rejection, ' + SPACE_ICONS.length + ' Space icons and 14 original SVG assets.');
