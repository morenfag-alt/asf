#!/usr/bin/env node
// Validation script: parse + execute the bottom <script> block of typing.html
// against a stub DOM/window environment to verify there are no syntax errors
// or top-level runtime errors.

'use strict';

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '..', '..', '..', 'typing.html');

const html = fs.readFileSync(HTML_PATH, 'utf8');

// Extract the LAST <script>...</script> block (the big inline script at the
// bottom of <body>; earlier <script> tags only reference src=).
const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
let lastInlineCode = null;
while ((match = scriptRe.exec(html)) !== null) {
  const attrs = match[1] || '';
  const body = match[2] || '';
  if (/\bsrc\s*=/.test(attrs)) continue;
  if (body.trim().length === 0) continue;
  lastInlineCode = body;
}

if (!lastInlineCode) {
  console.error('Could not find inline <script> block in typing.html');
  process.exit(1);
}

// ---- DOM stubs ----
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [],
    style: {},
    classList: {
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); },
      contains(c) { return this._set.has(c); },
    },
    dataset: {},
    attributes: {},
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      return child;
    },
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() {
      return { width: 800, height: 200, top: 0, left: 0, right: 800, bottom: 200 };
    },
    getContext() {
      return {
        save() {}, restore() {}, beginPath() {}, closePath() {},
        moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {},
        arc() {}, rect() {}, fill() {}, stroke() {}, fillRect() {},
        clearRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
        measureText() { return { width: 10 }; },
        scale() {}, translate() {}, rotate() {}, transform() {}, setTransform() {},
        createLinearGradient() { return { addColorStop() {} }; },
        createRadialGradient() { return { addColorStop() {} }; },
        drawImage() {},
        font: '', textAlign: '', textBaseline: '',
        fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
        lineCap: '', lineJoin: '', shadowColor: '', shadowBlur: 0,
      };
    },
    focus() {}, blur() {}, click() {}, scrollIntoView() {},
    insertBefore(node) { this.children.push(node); return node; },
    cloneNode() { return makeEl(this.tagName); },
    contains() { return false; },
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    width: 0, height: 0,
    offsetWidth: 800, offsetHeight: 200,
    clientWidth: 800, clientHeight: 200,
    nextSibling: null,
    previousSibling: null,
    firstChild: null,
    lastChild: null,
  };
  // Self-referential parent so .parentNode.insertBefore works without throwing.
  el.parentNode = el;
  el.parentElement = el;
  return el;
}

const stubDocument = {
  documentElement: makeEl('html'),
  body: makeEl('body'),
  head: makeEl('head'),
  fonts: { ready: Promise.resolve() },
  cookie: '',
  readyState: 'complete',
  hidden: false,
  visibilityState: 'visible',
  createElement: (tag) => makeEl(tag),
  createElementNS: (_ns, tag) => makeEl(tag),
  createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  createDocumentFragment: () => makeEl('fragment'),
  getElementById: () => makeEl('div'),
  querySelector: () => makeEl('div'),
  querySelectorAll: () => [],
  getElementsByTagName: () => [],
  getElementsByClassName: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
};

const stubLocalStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
})();

const stubWindow = {
  document: stubDocument,
  navigator: { userAgent: 'node-validate', language: 'ru', clipboard: { writeText: () => Promise.resolve() } },
  localStorage: stubLocalStorage,
  sessionStorage: stubLocalStorage,
  location: {
    href: 'http://localhost/typing.html',
    origin: 'http://localhost',
    pathname: '/typing.html',
    search: '',
    hash: '',
    host: 'localhost',
    hostname: 'localhost',
    protocol: 'http:',
    reload: () => {},
    assign: () => {},
    replace: () => {},
  },
  history: { pushState: () => {}, replaceState: () => {}, back: () => {}, forward: () => {} },
  innerWidth: 1280,
  innerHeight: 800,
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  fetch: () => Promise.resolve({
    ok: true, status: 200, statusText: 'OK',
    text: () => Promise.resolve(''),
    json: () => Promise.resolve([]),
    headers: { get: () => '' },
  }),
};

class StubMutationObserver {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}

class StubURLSearchParams {
  constructor(init) {
    this._map = new Map();
    if (typeof init === 'string') {
      const s = init.replace(/^\?/, '');
      if (s) {
        s.split('&').forEach(p => {
          const [k, v = ''] = p.split('=');
          if (k) this._map.set(decodeURIComponent(k), decodeURIComponent(v));
        });
      }
    }
  }
  get(k) { return this._map.has(k) ? this._map.get(k) : null; }
  set(k, v) { this._map.set(k, String(v)); }
  has(k) { return this._map.has(k); }
  delete(k) { this._map.delete(k); }
  toString() {
    return Array.from(this._map.entries())
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
  }
  forEach(fn) { this._map.forEach((v, k) => fn(v, k, this)); }
}

class StubImage {
  constructor() { this.src = ''; this.onload = null; this.onerror = null; }
  set src(v) { this._src = v; }
  get src() { return this._src || ''; }
}

const stubFetch = stubWindow.fetch;
const stubGetComputedStyle = stubWindow.getComputedStyle;
const stubReqAnim = stubWindow.requestAnimationFrame;

const stubConsole = {
  log: () => {},
  warn: () => {},
  error: () => {},
  info: () => {},
  debug: () => {},
};

// Compile + execute the script body inside a sandboxed Function.
let fn;
try {
  fn = new Function(
    'module', 'exports',
    'document', 'window', 'navigator', 'localStorage',
    'MutationObserver', 'URLSearchParams', 'fetch', 'Image', 'console',
    'requestAnimationFrame', 'setTimeout', 'setInterval',
    'clearInterval', 'clearTimeout', 'getComputedStyle',
    'location', 'history', 'URL', 'atob', 'btoa', 'performance',
    lastInlineCode
  );
} catch (err) {
  console.error('Syntax error while parsing inline <script>:');
  console.error(err && err.stack || err);
  process.exit(1);
}

try {
  fn(
    { exports: {} }, {},
    stubDocument, stubWindow, stubWindow.navigator, stubLocalStorage,
    StubMutationObserver, StubURLSearchParams, stubFetch, StubImage, stubConsole,
    stubReqAnim, setTimeout, setInterval,
    clearInterval, clearTimeout, stubGetComputedStyle,
    stubWindow.location, stubWindow.history,
    (typeof URL !== 'undefined' ? URL : function (u) { this.href = u; this.searchParams = new StubURLSearchParams(); }),
    (typeof atob !== 'undefined' ? atob : (s) => Buffer.from(s, 'base64').toString('binary')),
    (typeof btoa !== 'undefined' ? btoa : (s) => Buffer.from(s, 'binary').toString('base64')),
    (typeof performance !== 'undefined' ? performance : { now: () => Date.now() })
  );
} catch (err) {
  console.error('Runtime error during initial top-level execution:');
  console.error(err && err.stack || err);
  process.exit(1);
}

console.log('syntax ok');
process.exit(0);
