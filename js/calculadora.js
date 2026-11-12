function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { }
}

let expr = '';
let justEvaluated = false;
let hasError = false;
let useScientificNotation = false;
let lightMode = storageGet('lightMode') === 'true';
let calcHistory = loadHistory();

const OPS = ['+', '-', '×', '/', '^'];
const OPS_REGEX_END = /[+\-×\/^]+$/;
const CONSTANTS = {
  'π': Math.PI,
  'e': Math.E,
  'Φ': (1 + Math.sqrt(5)) / 2,
  '∞': Infinity
};

function loadHistory() {
  try {
    const data = JSON.parse(storageGet('calculatorHistory') || '[]');
    if (!Array.isArray(data)) return [];
    return data
      .filter(e => e && typeof e.expr === 'string' && typeof e.result === 'string')
      .slice(0, 50);
  } catch (e) {
    return [];
  }
}

const themeBtn = document.getElementById('themeBtn');
if (lightMode) document.body.classList.add('light-mode');
themeBtn.textContent = lightMode ? '🌙' : '☀️';

themeBtn.addEventListener('click', function () {
  lightMode = !lightMode;
  storageSet('lightMode', lightMode);
  document.body.classList.toggle('light-mode', lightMode);
  this.textContent = lightMode ? '🌙' : '☀️';
});

document.addEventListener('keydown', function (event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest && event.target.closest('#themeBtn, .btn-clear-history, #basePanel')) return;

  const key = event.key;

  // Teclado español: ^ es Shift + tecla muerta (event.key === 'Dead')
  if (key === 'Dead' && event.shiftKey && event.code === 'BracketLeft') {
    event.preventDefault();
    appendToken('^');
    return;
  }

  if (/^[0-9]$/.test(key)) {
    appendToken(key);
  } else if (key === '.' || key === ',') {
    appendToken('.');
  } else if (['+', '-', '/', '^', '(', ')'].includes(key)) {
    appendToken(key);
  } else if (key === '*' || key === 'x' || key === 'X') {
    appendToken('×');
  } else if (key === '!') {
    appendFactorial();
  } else if (key === '%') {
    appendPercentage();
  } else if (key === 'Enter' || key === '=') {
    event.preventDefault();
    calculate();
  } else if (key === 'Escape' || key === 'c' || key === 'C') {
    clearDisplay();
  } else if (key === 'Backspace') {
    event.preventDefault();
    backspace();
  }
});

function updateDisplay() {
  const display = document.getElementById('display');
  display.value = expr === '' ? '0' : expr;
  display.scrollLeft = display.scrollWidth;
  updateParenthesisIndicator();
  updateNotationIndicator();
}

function countParens() {
  const open = (expr.match(/\(/g) || []).length;
  const close = (expr.match(/\)/g) || []).length;
  return { open, close };
}

function updateParenthesisIndicator() {
  const { open, close } = countParens();
  const indicator = document.getElementById('parenIndicator');
  if (open > close) {
    indicator.textContent = `( × ${open - close}`;
    indicator.style.visibility = 'visible';
  } else {
    indicator.style.visibility = 'hidden';
  }
}

function updateNotationIndicator() {
  const indicator = document.getElementById('notationIndicator');
  if (useScientificNotation) {
    indicator.textContent = 'Científica';
    indicator.style.display = 'block';
  } else {
    indicator.style.display = 'none';
  }
}

function prepareForInput(startsNewValue) {
  if (hasError) {
    expr = '';
    hasError = false;
    justEvaluated = false;
  } else if (justEvaluated) {
    if (startsNewValue) expr = '';
    justEvaluated = false;
  }
}

function appendDigit(d) {
  prepareForInput(true);
  const segment = expr.match(/[\d.]*$/)[0];
  if (segment === '0') {
    expr = expr.slice(0, -1) + d;
  } else {
    expr += d;
  }
}

function appendDecimal() {
  prepareForInput(true);
  const segment = expr.match(/[\d.]*$/)[0];
  if (segment.includes('.')) return;
  expr += segment === '' ? '0.' : '.';
}

function appendOperator(op) {
  prepareForInput(false);
  if (expr === '') {
    if (op === '-') expr = '-';
    return;
  }
  const last = expr.slice(-1);
  if (last === '(') {
    if (op === '-') expr += op;
    return;
  }
  if (OPS.includes(last)) {
    if (op === '-' && ['×', '/', '^'].includes(last)) {
      expr += op;
    } else {
      const base = expr.replace(OPS_REGEX_END, '');
      if (base === '' || base.endsWith('(')) {
        expr = op === '-' ? base + '-' : base;
      } else {
        expr = base + op;
      }
    }
    return;
  }
  expr += op;
}

function appendOpenParen() {
  prepareForInput(true);
  expr += '(';
}

function appendCloseParen() {
  prepareForInput(false);
  const { open, close } = countParens();
  if (open <= close) return;
  const last = expr.slice(-1);
  if (last === '' || last === '(' || OPS.includes(last)) return;
  expr += ')';
}

function appendConstant(symbol) {
  prepareForInput(true);
  expr += symbol;
}

function appendToken(token) {
  if (token === '*') token = '×';
  if (/^\d$/.test(token)) appendDigit(token);
  else if (token === '.') appendDecimal();
  else if (OPS.includes(token)) appendOperator(token);
  else if (token === '(') appendOpenParen();
  else if (token === ')') appendCloseParen();
  else if (Object.prototype.hasOwnProperty.call(CONSTANTS, token)) appendConstant(token);
  updateDisplay();
}

function applyFunctionToken(name) {
  if (justEvaluated && !hasError && expr !== '') {
    // Hay un resultado en pantalla: se aplica la función a ese valor
    expr = `${name}(${expr})`;
    justEvaluated = false;
  } else {
    prepareForInput(true);
    expr += `${name}(`;
  }
  updateDisplay();
}

function appendFunction(name) { applyFunctionToken(name); }
function appendSqrt() { applyFunctionToken('√'); }

function appendInfinity() {
  appendToken('∞');
}

function appendPostfix(symbol) {
  if (hasError || expr === '') return;
  const last = expr.slice(-1);
  if (last === '(' || OPS.includes(last)) return;
  justEvaluated = false;
  expr += symbol;
  updateDisplay();
}

function appendFactorial() { appendPostfix('!'); }
function appendPercentage() { appendPostfix('%'); }

function toggleScientificNotation() {
  useScientificNotation = !useScientificNotation;
  if (justEvaluated && !hasError) {
    try { expr = formatResult(evaluate(expr)); } catch (e) { }
  }
  updateDisplay();
}

function backspace() {
  if (hasError) {
    clearDisplay();
    return;
  }
  justEvaluated = false;
  expr = expr.replace(/(sin\(|cos\(|tan\(|log\(|ln\(|√\(|.)$/, '');
  updateDisplay();
}

function clearDisplay() {
  expr = '';
  hasError = false;
  justEvaluated = false;
  updateDisplay();
}

function factorial(n) {
  if (n === Infinity) return Infinity;
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function tokenize(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m;
    if ((m = rest.match(/^(\d+\.?\d*|\.\d+)/))) {
      tokens.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
    } else if ((m = rest.match(/^(sin|cos|tan|log|ln|√)\(/))) {
      tokens.push({ t: 'func', v: m[1] });
      i += m[0].length;
    } else if (Object.prototype.hasOwnProperty.call(CONSTANTS, rest[0])) {
      tokens.push({ t: 'num', v: CONSTANTS[rest[0]] });
      i += 1;
    } else if ('+-×/^()!%'.includes(rest[0])) {
      tokens.push({ t: rest[0] });
      i += 1;
    } else {
      throw new Error('Carácter no válido');
    }
  }
  return tokens;
}

// Elimina el ruido de coma flotante (p. ej. sin(π) = 1.2e-16 -> 0)
const cleanTrig = fn => x => {
  const r = fn(x);
  return Math.abs(r) < 1e-14 ? 0 : r;
};

const FUNCTIONS = {
  'sin': cleanTrig(Math.sin),
  'cos': cleanTrig(Math.cos),
  'tan': cleanTrig(Math.tan),
  'log': Math.log10,
  'ln': Math.log,
  '√': Math.sqrt
};

function evaluate(s) {
  const tokens = tokenize(s);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let v = parseTerm();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = next().t;
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  function startsOperand(tok) {
    return tok && (tok.t === 'num' || tok.t === 'func' || tok.t === '(');
  }

  function parseTerm() {
    let v = parseUnary();
    for (;;) {
      const tk = peek();
      if (!tk) break;
      if (tk.t === '×') { next(); v *= parseUnary(); }
      else if (tk.t === '/') { next(); v /= parseUnary(); }
      else if (startsOperand(tk)) { v *= parseUnary(); }
      else break;
    }
    return v;
  }

  function parseUnary() {
    const tk = peek();
    if (tk && tk.t === '-') { next(); return -parseUnary(); }
    if (tk && tk.t === '+') { next(); return parseUnary(); }
    return parsePower();
  }

  function parsePower() {
    const base = parsePostfix();
    if (peek() && peek().t === '^') {
      next();
      return Math.pow(base, parseExponent());
    }
    return base;
  }

  function parseExponent() {
    const tk = peek();
    if (tk && tk.t === '-') { next(); return -parseExponent(); }
    if (tk && tk.t === '+') { next(); return parseExponent(); }
    return parsePower();
  }

  function parsePostfix() {
    let v = parsePrimary();
    while (peek() && (peek().t === '!' || peek().t === '%')) {
      v = next().t === '!' ? factorial(v) : v / 100;
    }
    return v;
  }

  function closeParen() {
    if (peek() && peek().t === ')') next();
    else if (peek()) throw new Error('Expresión no válida');
  }

  function parsePrimary() {
    const tk = next();
    if (!tk) throw new Error('Expresión incompleta');
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'func') {
      const arg = parseExpr();
      closeParen();
      return FUNCTIONS[tk.v](arg);
    }
    if (tk.t === '(') {
      const v = parseExpr();
      closeParen();
      return v;
    }
    throw new Error('Expresión no válida');
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Expresión no válida');
  return result;
}

function formatResult(r) {
  if (r === Infinity) return '∞';
  if (r === -Infinity) return '-∞';
  const rounded = parseFloat(r.toPrecision(12));
  const plain = String(rounded);
  const needsExponent = (useScientificNotation && Math.abs(rounded) >= 1e6) || plain.includes('e');
  if (!needsExponent) return plain;
  let [mantissa, exponent] = rounded.toExponential(6).split('e');
  mantissa = mantissa.replace(/\.?0+$/, '');
  return `${mantissa}×10^${parseInt(exponent, 10)}`;
}

function showError() {
  hasError = true;
  justEvaluated = false;
  expr = 'Error';
  updateDisplay();
}

function calculate() {
  if (expr === '' || hasError || justEvaluated) return;

  let result;
  try {
    result = evaluate(expr);
  } catch (e) {
    showError();
    return;
  }
  if (typeof result !== 'number' || Number.isNaN(result)) {
    showError();
    return;
  }

  const text = formatResult(result);
  addToHistory(expr, text);
  expr = text;
  justEvaluated = true;
  updateDisplay();
}

function copyResult() {
  if (expr === '' || hasError) return;
  const value = expr;
  const btn = document.querySelector('.btn-copy');
  const done = () => {
    const old = btn.textContent;
    btn.textContent = '✅';
    setTimeout(() => { btn.textContent = old; }, 1000);
  };
  const fallback = () => {
    const temp = document.createElement('textarea');
    temp.value = value;
    document.body.appendChild(temp);
    temp.select();
    try { if (document.execCommand('copy')) done(); } catch (e) { }
    document.body.removeChild(temp);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(done).catch(fallback);
  } else {
    fallback();
  }
}

function addToHistory(expression, result) {
  calcHistory.unshift({ expr: expression, result: result });
  if (calcHistory.length > 50) calcHistory.pop();
  storageSet('calculatorHistory', JSON.stringify(calcHistory));
  updateHistoryDisplay();
}

function toggleHistory() {
  document.getElementById('historyPanel').classList.toggle('show');
}

function clearHistory() {
  calcHistory = [];
  storageSet('calculatorHistory', JSON.stringify(calcHistory));
  updateHistoryDisplay();
}

function updateHistoryDisplay() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  calcHistory.forEach((entry, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.index = index;
    item.textContent = `${entry.expr} = ${entry.result}`;
    item.title = item.textContent;
    list.appendChild(item);
  });
}

document.getElementById('historyList').addEventListener('click', function (event) {
  const item = event.target.closest('.history-item');
  if (!item) return;
  const entry = calcHistory[Number(item.dataset.index)];
  if (!entry) return;
  expr = entry.result;
  hasError = false;
  justEvaluated = true;
  updateDisplay();
});

const BASE_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE_NAMES = { 2: 'Binario', 8: 'Octal', 10: 'Decimal', 16: 'Hexadecimal' };
let baseValue = null;
let baseRaw = {};

function toggleBase() {
  document.getElementById('basePanel').classList.toggle('show');
}

function parseInBase(text, base) {
  let s = text.trim().replace(/[\s_]/g, '').toLowerCase();
  if (s === '') return null;
  let negative = false;
  if (s[0] === '-') { negative = true; s = s.slice(1); }
  else if (s[0] === '+') { s = s.slice(1); }
  if (base === 16 && s.startsWith('0x')) s = s.slice(2);
  if (base === 2 && s.startsWith('0b')) s = s.slice(2);
  if (base === 8 && s.startsWith('0o')) s = s.slice(2);
  if (s === '') throw new Error('Falta el número');

  const B = BigInt(base);
  let value = 0n;
  for (const ch of s) {
    const d = BASE_DIGITS.indexOf(ch);
    if (d < 0 || d >= base) {
      throw new Error(`"${ch.toUpperCase()}" no es un dígito válido en base ${base}`);
    }
    value = value * B + BigInt(d);
  }
  return negative ? -value : value;
}

function groupBinary(str) {
  const sign = str.startsWith('-') ? '-' : '';
  const digits = sign ? str.slice(1) : str;
  return sign + digits.replace(/\B(?=(\d{4})+(?!\d))/g, ' ');
}

function setBaseOutputs(value) {
  const map = {
    bin: [2, 'outBin'], oct: [8, 'outOct'], dec: [10, 'outDec'],
    hex: [16, 'outHex']
  };
  baseRaw = {};
  for (const key in map) {
    const [b, id] = map[key];
    const el = document.getElementById(id);
    if (value === null) {
      el.textContent = '';
      continue;
    }
    const raw = value.toString(b).toUpperCase();
    baseRaw[key] = raw;
    el.textContent = key === 'bin' ? groupBinary(raw) : raw;
  }
}

function updateBase() {
  const error = document.getElementById('baseError');
  const from = parseInt(document.getElementById('baseFrom').value, 10);
  error.textContent = '';
  try {
    baseValue = parseInBase(document.getElementById('baseInput').value, from);
  } catch (e) {
    baseValue = null;
    error.textContent = e.message;
  }
  setBaseOutputs(baseValue);
}

function baseFromDisplay() {
  const error = document.getElementById('baseError');
  try {
    if (hasError || expr === '') throw new Error('No hay nada en la pantalla');
    const r = evaluate(expr);
    if (!Number.isFinite(r) || !Number.isInteger(r)) throw new Error('La pantalla no contiene un número entero');
    if (Math.abs(r) > Number.MAX_SAFE_INTEGER) throw new Error('El número es demasiado grande para leerlo de la pantalla');
    document.getElementById('baseFrom').value = '10';
    document.getElementById('baseInput').value = String(r);
    updateBase();
  } catch (e) {
    error.textContent = e.message;
  }
}

function baseToDisplay() {
  if (baseValue === null) return;
  expr = baseValue.toString(10);
  hasError = false;
  justEvaluated = true;
  updateDisplay();
}

function copyText(value, done) {
  const fallback = () => {
    const temp = document.createElement('textarea');
    temp.value = value;
    document.body.appendChild(temp);
    temp.select();
    try { if (document.execCommand('copy')) done(); } catch (e) { }
    document.body.removeChild(temp);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(done).catch(fallback);
  } else {
    fallback();
  }
}

(function initBasePanel() {
  const select = document.getElementById('baseFrom');
  for (const b of [2, 8, 10, 16]) {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = `${BASE_NAMES[b]} (${b})`;
    select.appendChild(opt);
  }
  select.value = '10';

  document.getElementById('baseInput').addEventListener('input', updateBase);
  select.addEventListener('change', updateBase);

  document.getElementById('basePanel').addEventListener('click', function (event) {
    const row = event.target.closest('.base-row');
    if (!row || event.target.closest('input')) return;
    const raw = baseRaw[row.dataset.out];
    if (!raw) return;
    const label = row.querySelector('.base-value');
    copyText(raw, () => {
      const old = label.textContent;
      label.textContent = 'Copiado ✓';
      setTimeout(() => { label.textContent = old; }, 800);
    });
  });
})();

updateHistoryDisplay();
updateDisplay();
