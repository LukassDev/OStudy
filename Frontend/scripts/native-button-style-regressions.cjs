/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Exercise the installed Android interop engine, not its web/Node fallback.
// Only the device host components are replaced; React and NativeWind are real.
process.env.NODE_ENV = 'production';
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const rendered = [];
let pressed = false;
let activeColors;
let nativeApi;
const flatten = value => Array.isArray(value)
  ? Object.assign({}, ...value.map(flatten))
  : value && typeof value === 'object' ? value : {};
const subscription = () => ({ remove() {} });
const host = props => React.createElement('span', null, props.children);
const native = {
  View: host,
  Text: props => React.createElement('span', null, props.children),
  ActivityIndicator: () => null,
  Pressable: props => {
    rendered.push({ props, style: flatten(typeof props.style === 'function' ? props.style({ pressed }) : props.style) });
    return React.createElement('button', null, props.children);
  },
  Appearance: { getColorScheme: () => 'dark', addChangeListener: subscription },
  AppState: { currentState: 'active', addEventListener: subscription },
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: subscription },
  Dimensions: { get: () => ({ width: 390, height: 844 }), addEventListener: subscription },
  Platform: { OS: 'android', select: options => options.android ?? options.native ?? options.default },
  PixelRatio: { get: () => 1, getFontScale: () => 1, roundToNearestPixel: value => value },
  I18nManager: { isRTL: false },
  StyleSheet: { create: value => value, flatten, hairlineWidth: 1 },
};
const loadOriginal = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'react-native') return native;
  if (parent?.filename.replaceAll('\\', '/').endsWith('/runtime/wrap-jsx.js')) {
    if (name === './api') return nativeApi;
    // Register only the host components used by this test, as Metro does.
    if (name === './components') return {};
  }
  return loadOriginal.call(this, name, parent, isMain);
};

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: 'react-native-css-interop',
    esModuleInterop: true,
  } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', output)(name =>
    name in mocks ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}

try {
  nativeApi = require('react-native-css-interop/dist/runtime/native/api');
  for (const component of [native.Pressable, native.View, native.Text, native.ActivityIndicator]) {
    nativeApi.cssInterop(component, { className: 'style' });
  }
  const { jsx } = require('react-native-css-interop/jsx-runtime');
  // Control: reproduce the installed dependency's failure before testing our fix.
  rendered.length = 0;
  renderToStaticMarkup(jsx(native.Pressable, { style: () => ({ backgroundColor: 'red', padding: 14 }) }));
  const dropsCallbackStyles = rendered[0].style.backgroundColor === undefined;
  console.log(`Installed native interop drops callback styles: ${dropsCallbackStyles}`);

  const tokens = load('src/constants/theme.tokens.ts');
  const theme = { ...tokens, useThemeColors: () => activeColors };
  const { Button } = load('src/components/ui/Button.tsx', { '../../constants/theme': theme });
  const { AppPressable } = load('src/components/ui/AppPressable.tsx', { '../../constants/theme': theme });
  for (activeColors of [tokens.darkColors, tokens.lightColors]) {
    for (const variant of ['primary', 'outline', 'secondary', 'danger', 'ghost']) {
      for (pressed of [false, true]) {
        rendered.length = 0;
        renderToStaticMarkup(React.createElement(Button, { title: 'Guardar', onPress() {}, variant }));
        const button = rendered[0];
        assert.equal(button.style.borderRadius, 12, `${variant}: preserve native button shape`);
        assert.equal(button.style.paddingVertical, 14, `${variant}: preserve native touch target`);
        const expected = variant === 'primary' ? pressed ? activeColors.primaryPressed : activeColors.primaryStrong
          : variant === 'danger' ? activeColors.error
          : variant === 'ghost' ? 'transparent' : activeColors.surfaceElevated;
        assert.equal(button.style.backgroundColor, expected, `${variant}: preserve native background`);
        if (variant === 'outline' || variant === 'secondary') assert.equal(button.style.borderWidth, 1);
      }
    }
    for (const state of [{ disabled: true }, { loading: true }]) {
      rendered.length = 0;
      renderToStaticMarkup(React.createElement(Button, { title: 'Guardar', onPress() {}, ...state }));
      assert.equal(rendered[0].props.disabled, true);
      assert.equal(rendered[0].style.backgroundColor, activeColors.primaryStrong);
      assert.equal(rendered[0].style.opacity, 0.48);
    }
    for (pressed of [false, true]) {
      rendered.length = 0;
      renderToStaticMarkup(React.createElement(AppPressable, {
        onPress() {}, error: true, style: { backgroundColor: activeColors.surfaceElevated, padding: 16 },
      }));
      assert.equal(rendered[0].style.backgroundColor, activeColors.surfaceElevated);
      assert.equal(rendered[0].style.padding, 16);
      assert.equal(rendered[0].style.minHeight, tokens.interaction.minTarget);
      assert.equal(rendered[0].style.borderColor, activeColors.error);
      assert.equal(rendered[0].style.opacity, pressed ? tokens.interaction.pressedOpacity : 1);
    }
  }
  let callbackControls = 0;
  function auditCallbacks(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { auditCallbacks(file); continue; }
      if (!file.endsWith('.tsx')) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'Pressable') {
          const attributes = node.attributes.properties;
          const style = attributes.find(attribute => attribute.name?.getText(source) === 'style');
          const expression = style?.initializer && ts.isJsxExpression(style.initializer) ? style.initializer.expression : undefined;
          if (expression && (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression))) {
            callbackControls++;
            const optOut = attributes.find(attribute => attribute.name?.getText(source) === 'cssInterop');
            assert.equal(optOut?.initializer?.getText(source), '{false}', `${path.relative(root, file)}: preserve native style callback`);
            assert.ok(!attributes.some(attribute => attribute.name?.getText(source) === 'className'), `${file}: bypassing interop requires inline styles`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  auditCallbacks(path.join(root, 'app'));
  auditCallbacks(path.join(root, 'src/components'));
  assert.ok(callbackControls >= 6, 'Audit must include all affected controls');
  console.log(`PASS: Android production interop, both themes, five button variants, pressed/loading/disabled styling and ${callbackControls} callback controls.`);
} finally {
  Module._load = loadOriginal;
}
