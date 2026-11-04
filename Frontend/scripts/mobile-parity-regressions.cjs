const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', result.outputText)(name => {
    if (!(name in mocks)) throw new Error(`Unexpected native import: ${name}`);
    return mocks[name];
  }, mod, mod.exports);
  return mod.exports;
}
const helpers = load('src/components/study/lessonHelpers.ts', {});
const { earliestLessonMinute, layoutDay, visibleScheduleHours } = load('src/components/study/scheduleLayout.ts', { './lessonHelpers': helpers });
const lesson = (id, start, end) => ({ id, title: id, weekday: 1, start_time: start, end_time: end, room: '', space_id: null });
const lessons = [lesson('a', '09:00', '10:00'), lesson('b', '09:30', '11:00'), lesson('c', '10:00', '10:30'), lesson('d', '11:00', '12:00')];
const positions = layoutDay(lessons);
assert.equal(positions[0].lanes, 2);
assert.equal(positions[0].lane, positions[2].lane, 'Adjacent lessons reuse a lane');
assert.notEqual(positions[0].lane, positions[1].lane, 'Overlapping lessons remain visible');
assert.equal(positions[3].lanes, 1, 'A new cluster uses the full day width');
assert.deepEqual(layoutDay([]), []);
assert.equal(earliestLessonMinute([]), 480);
assert.equal(earliestLessonMinute([lesson('late', '14:00', '15:00'), lesson('early', '08:15', '09:00')]), 495);
assert.equal(earliestLessonMinute([lesson('midnight', '00:00', '01:00')]), 0);
assert.equal(earliestLessonMinute([lesson('bad', 'invalid', '15:00'), lesson('only', '11:40', '13:20')]), 700);
assert.deepEqual(visibleScheduleHours(0, 400, 64), { start: 0, end: 9 });
assert.deepEqual(visibleScheduleHours(23 * 64, 400, 64), { start: 21, end: 24 });

const createCalls = [], editCalls = [];
const hookState = [];
let hookIndex = 0;
const { WeekSchedule } = load('src/components/study/WeekSchedule.tsx', {
  react: { memo: component => component, createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useState: initial => {
    const index = hookIndex++;
    if (!(index in hookState)) hookState[index] = initial;
    return [hookState[index], value => { hookState[index] = typeof value === 'function' ? value(hookState[index]) : value; }];
  }, useRef: value => ({ current: value }), useCallback: fn => fn, useMemo: fn => fn(), useEffect: () => {} },
  'react-native': { ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View' },
  'react-i18next': { useTranslation: () => ({ t: key => key, i18n: { language: 'en' } }) },
  '../../constants/theme': { useThemeColors: () => ({}), useSpaceColorMap: () => ({}) },
  './lessonHelpers': helpers,   './scheduleLayout': { earliestLessonMinute, layoutDay, visibleScheduleHours }, '../ui/Button': { Button: 'Button' },
});
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== 'object') return [];
  return [node, ...node.children.flatMap(flatten)];
}
function render(disabled) {
  hookIndex = 0;
  return flatten(WeekSchedule({ lessons, spaces: [], disabled, onCreate: (...args) => createCalls.push(args), onEdit: value => editCalls.push(value) }));
}
const nodes = render(false);
assert.equal(nodes.filter(n => n.type === 'ScrollView').length, 2, 'Native schedule scrolls in both directions');
const initialVisibleHours = visibleScheduleHours(9 * 64, 464, 64);
const slots = nodes.filter(n => n.props.accessibilityLabel?.startsWith('update15.addLesson ·'));
assert.equal(slots.length, 7 * (initialVisibleHours.end - initialVisibleHours.start) * 2, 'Only visible half-hour slots are rendered');
const timeline = nodes.find(n => n.props.onContentSizeChange);
const scrollCalls = [];
timeline.props.ref.current = { scrollTo: value => scrollCalls.push(value) };
timeline.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
timeline.props.onContentSizeChange(360, 1536);
timeline.props.onContentSizeChange(360, 1536);
assert.deepEqual(scrollCalls, [{ y: 576, animated: false }], 'Open at the earliest lesson once; later layout changes must not reset scrolling');
const slot = nodes.find(n => n.props.accessibilityLabel === 'update15.addLesson · Monday 08:30');
assert.ok(slot);
slot.props.onPress();
assert.deepEqual(createCalls[0], [1, '08:30', '09:30']);
const card = nodes.find(n => n.props.accessibilityLabel?.startsWith('b, 09:30'));
card.props.onPress();
assert.equal(editCalls[0].id, 'b');
hookState[2] = 0;
const midnightSlot = render(false).find(n => n.props.accessibilityLabel === 'update15.addLesson · Monday 00:00');
assert.ok(midnightSlot);
midnightSlot.props.onPress();
assert.deepEqual(createCalls[1], [1, '00:00', '01:00']);
hookState[2] = 23;
const lateSlot = render(false).find(n => n.props.accessibilityLabel === 'update15.addLesson · Sunday 23:30');
assert.ok(lateSlot);
lateSlot.props.onPress();
assert.deepEqual(createCalls[2], [0, '23:30', '23:59'], 'Late lessons stay within the same day');
assert.ok(render(true).filter(n => n.type === 'TouchableOpacity' || n.type === 'Button').every(n => n.props.disabled));
for (const locale of ['pt-BR', 'en', 'es', 'fr', 'de', 'it']) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/i18n/locales', `${locale}.json`), 'utf8'));
  for (const value of [data.scheduleMobile.hint, data.scheduleWeb.hint, data.chatList.conversationsHeading, data.sidebar.home]) assert.ok(value, locale);
}
console.log('Mobile parity regressions passed: overlapping lessons, touch actions, disabled state and six languages.');
