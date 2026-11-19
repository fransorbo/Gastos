// Simulación mínima de SpreadsheetApp & cía para ejecutar los .gs fuera de Google (con JavaScriptCore de macOS).
// Uso: tests/correr.sh
var console = { log: (...a) => print(a.join(' ')), error: (...a) => print('ERR ' + a.join(' ')) };

function FakeRange(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
FakeRange.prototype = {
  _ensure() { this.sh._ensure(this.r + this.nr - 1, this.c + this.nc - 1); },
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh._get(this.r + i, this.c + j)); out.push(row); } return out; },
  setValues(v) {
    if (v.length !== this.nr || v[0].length !== this.nc) throw new Error('setValues size mismatch ' + v.length + 'x' + v[0].length + ' vs ' + this.nr + 'x' + this.nc);
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, v[i][j]);
    return this;
  },
  getValue() { return this.sh._get(this.r, this.c); },
  setValue(v) { this.sh._set(this.r, this.c, v); return this; },
  getFormulasR1C1() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.formulas[(this.r + i) + ',' + (this.c + j)] || ''); out.push(row); } return out; },
  setFormulaR1C1(f) {
    this.sh.formulas[this.r + ',' + this.c] = f;
    let d = this.sh._get(this.r, 4);
    if (typeof d === 'string') { const [y, m, dd] = d.split('-').map(Number); d = new Date(y, m - 1, dd); }
    this.sh._set(this.r, this.c, /YEAR/.test(f) ? d.getFullYear() : d.getMonth() + 1);
    return this;
  },
  setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; },
  setNote() { return this; }, insertCheckboxes() { for (let i = 0; i < this.nr; i++) if (this.sh._get(this.r + i, this.c) === '') this.sh._set(this.r + i, this.c, false); return this; },
  copyTo() { return this; },
  getRow() { return this.r; },
  createTextFinder(val) {
    const rng = this; let entire = false;
    const tf = {
      matchEntireCell(b) { entire = b; return tf; }, matchCase() { return tf; },
      findAll() {
        const res = [];
        for (let i = 0; i < rng.nr; i++) for (let j = 0; j < rng.nc; j++) {
          const v = String(rng.sh._get(rng.r + i, rng.c + j));
          if (entire ? v === val : v.indexOf(val) >= 0) res.push(new FakeRange(rng.sh, rng.r + i, rng.c + j, 1, 1));
        }
        return res;
      },
    };
    return tf;
  },
};

function FakeSheet(ss, name, rows, maxRows, maxCols) {
  this.ss = ss; this.name = name; this.formulas = {};
  this.maxRows = maxRows || 1000; this.maxCols = maxCols || 26;
  this.data = [];
  (rows || []).forEach((r, i) => r.forEach((v, j) => this._set(i + 1, j + 1, v)));
}
FakeSheet.prototype = {
  _ensure(r, c) { if (r > this.maxRows || c > this.maxCols) throw new Error(this.name + ': fuera de la grilla ' + r + ',' + c + ' (max ' + this.maxRows + 'x' + this.maxCols + ')'); },
  _get(r, c) { this._ensure(r, c); const row = this.data[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined ? '' : v; },
  _set(r, c, v) { this._ensure(r, c); while (this.data.length < r) this.data.push([]); this.data[r - 1][c - 1] = v; },
  getName() { return this.name; }, setName(n) { this.name = n; return this; },
  getParent() { return this.ss; },
  getMaxRows() { return this.maxRows; }, getMaxColumns() { return this.maxCols; },
  getLastRow() { for (let r = this.data.length; r >= 1; r--) if ((this.data[r - 1] || []).some(v => v !== '' && v !== undefined)) return r; return 0; },
  getLastColumn() { let m = 0; this.data.forEach(row => row.forEach((v, j) => { if (v !== '' && v !== undefined && j + 1 > m) m = j + 1; })); return m; },
  getRange(r, c, nr, nc) { const g = new FakeRange(this, r, c, nr || 1, nc || 1); g._ensure(); return g; },
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); },
  insertRowsAfter(_, n) { this.maxRows += n; },
  insertRowsBefore(r, n) {
    while (this.data.length < r - 1) this.data.push([]);
    this.data.splice(r - 1, 0, ...Array.from({ length: n }, () => []));
    this.maxRows += n;
    const nf = {}; Object.keys(this.formulas).forEach(k => { const [fr, fc] = k.split(',').map(Number); nf[(fr >= r ? fr + n : fr) + ',' + fc] = this.formulas[k]; }); this.formulas = nf;
  },
  insertColumnsAfter(_, n) { this.maxCols += n; },
  deleteRow(r) {
    this.data.splice(r - 1, 1); this.maxRows -= 1;
    const nf = {}; Object.keys(this.formulas).forEach(k => { const [fr, fc] = k.split(',').map(Number); if (fr < r) nf[k] = this.formulas[k]; else if (fr > r) nf[(fr - 1) + ',' + fc] = this.formulas[k]; }); this.formulas = nf;
  },
  setFrozenRows() {}, setColumnWidth() {},
  copyTo(ss) { const s = new FakeSheet(ss, 'Copia de ' + this.name, JSON.parse(JSON.stringify(this.data)), this.maxRows, this.maxCols); ss.sheets.push(s); return s; },
};

function FakeSS(id, sheets) { this.id = id; this.sheets = []; (sheets || []).forEach(s => this.sheets.push(new FakeSheet(this, s.name, s.rows, s.maxRows, s.maxCols))); }
FakeSS.prototype = {
  getId() { return this.id; },
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
  insertSheet(n) { const s = new FakeSheet(this, n, [], 1000, 26); this.sheets.push(s); return s; },
  getNumSheets() { return this.sheets.length; }, setActiveSheet() {}, moveActiveSheet() {},
};

var FAKE = {};
var SpreadsheetApp = {
  openById(id) { if (!FAKE[id]) throw new Error('No existe ss ' + id); return FAKE[id]; },
  flush() {}, CopyPasteType: { PASTE_FORMAT: 'fmt' },
};
var Utilities = {
  formatDate(d, tz, fmt) {
    const p = n => String(n).padStart(2, '0');
    return fmt.replace("'T'", 'T').replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
      .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()));
  },
  getUuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => (Math.random() * 16 | 0).toString(16)); },
};
var LockService = { getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; } };
var _props = {};
var PropertiesService = { getScriptProperties() { return { getProperty: k => _props[k] || null, setProperty: (k, v) => { _props[k] = v; }, deleteProperty: k => { delete _props[k]; } }; } };
var ContentService = { MimeType: { JSON: 'json' }, createTextOutput(s) { return { s, setMimeType() { return this; } }; } };
var _triggers = [];
var ScriptApp = {
  getProjectTriggers() { return _triggers; }, deleteTrigger(t) { _triggers = _triggers.filter(x => x !== t); },
  newTrigger(fn) { const b = { timeBased() { return b; }, everyDays() { return b; }, atHour() { return b; }, inTimezone() { return b; }, create() { _triggers.push({ getHandlerFunction: () => fn }); } }; return b; },
};
