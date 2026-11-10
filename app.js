/* Rozkład zużycia wody – logika aplikacji
 * Wszystkie obliczenia lokalnie w przeglądarce.
 */
(function () {
  'use strict';

  const METER_COUNT = 4;
  const WEEKEND_MIN = 1.20;   // weekend / święto: +20%
  const WEEKEND_MAX = 1.30;   // ... do +30%
  const NOISE = 0.05;         // lekkie wahania ±5% dla każdego dnia
  const STORAGE_KEY = 'rozklad-wody-v1';
  const DAY_MS = 86400000;
  const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const WEEKDAYS_SHORT = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('pl-PL', { maximumFractionDigits: 3 });

  /* ---------- Daty (UTC, żeby uniknąć problemów ze zmianą czasu) ---------- */
  function parseDate(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str || '')) return null;
    const [y, m, d] = str.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  function isoDate(t) { return new Date(t).toISOString().slice(0, 10); }
  function plDate(t) {
    const d = new Date(t);
    return String(d.getUTCDate()).padStart(2, '0') + '.' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear();
  }

  /* ---------- Polskie święta ustawowo wolne ---------- */
  function easterSunday(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }

  const holidayCache = {};
  function holidaysForYear(y) {
    if (holidayCache[y]) return holidayCache[y];
    const map = new Map();
    const add = (t, name) => map.set(isoDate(t), name);
    const fixed = (m, d, name) => add(Date.UTC(y, m - 1, d), name);
    fixed(1, 1, 'Nowy Rok');
    fixed(1, 6, 'Trzech Króli');
    const e = easterSunday(y);
    add(e, 'Wielkanoc');
    add(e + 1 * DAY_MS, 'Poniedziałek Wielkanocny');
    fixed(5, 1, 'Święto Pracy');
    fixed(5, 3, 'Święto Konstytucji 3 Maja');
    add(e + 49 * DAY_MS, 'Zielone Świątki');
    add(e + 60 * DAY_MS, 'Boże Ciało');
    fixed(8, 15, 'Wniebowzięcie NMP');
    fixed(11, 1, 'Wszystkich Świętych');
    fixed(11, 11, 'Święto Niepodległości');
    if (y >= 2025) fixed(12, 24, 'Wigilia');
    fixed(12, 25, 'Boże Narodzenie');
    fixed(12, 26, 'Drugi dzień Bożego Narodzenia');
    holidayCache[y] = map;
    return map;
  }
  function holidayName(t) {
    return holidaysForYear(new Date(t).getUTCFullYear()).get(isoDate(t)) || null;
  }

  /* ---------- Liczby ---------- */
  function parseNum(str) {
    if (str == null) return null;
    const s = String(str).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- Budowa formularza ---------- */
  function buildMeters() {
    const box = $('meters');
    let html = '';
    for (let i = 1; i <= METER_COUNT; i++) {
      html += `
        <fieldset class="meter" data-i="${i}" style="margin:0">
          <label class="name full">Nazwa licznika
            <input type="text" id="m${i}-name" value="Licznik ${i}" maxlength="40">
          </label>
          <label>Stan początkowy
            <input type="text" inputmode="decimal" id="m${i}-start" placeholder="np. 1250" autocomplete="off">
          </label>
          <label>Stan końcowy
            <input type="text" inputmode="decimal" id="m${i}-end" placeholder="np. 1318" autocomplete="off">
          </label>
          <label class="full">Maks. dzienne zużycie (opcjonalnie)
            <input type="text" inputmode="decimal" id="m${i}-max" placeholder="bez limitu" autocomplete="off">
          </label>
        </fieldset>`;
    }
    box.innerHTML = html;
  }

  const FIELD_IDS = () => {
    const ids = ['dateFrom', 'dateTo'];
    for (let i = 1; i <= METER_COUNT; i++) ids.push(`m${i}-name`, `m${i}-start`, `m${i}-end`, `m${i}-max`);
    return ids;
  };

  function saveForm() {
    try {
      const data = {};
      FIELD_IDS().forEach((id) => { data[id] = $(id).value; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* brak dostępu do pamięci – ignorujemy */ }
  }
  function loadForm() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) return;
      FIELD_IDS().forEach((id) => { if (data[id] != null && $(id)) $(id).value = data[id]; });
    } catch (e) { /* ignorujemy */ }
  }

  function updatePeriodInfo() {
    const a = parseDate($('dateFrom').value), b = parseDate($('dateTo').value);
    const el = $('periodInfo');
    if (a == null || b == null || b <= a) { el.textContent = ''; return; }
    const days = buildDays(a, b);
    const free = days.filter((d) => d.type !== 'work').length;
    el.textContent = `Okres: ${days.length} dni (od ${plDate(a + DAY_MS)} do ${plDate(b)}), w tym ${free} dni weekendowych/świątecznych.`;
  }

  /* ---------- Dni okresu ---------- */
  function buildDays(from, to) {
    // Zużycie przypada na dni od dnia po ostatnim odczycie do dnia najnowszego odczytu włącznie
    const days = [];
    for (let t = from + DAY_MS; t <= to; t += DAY_MS) {
      const dow = new Date(t).getUTCDay();
      const hol = holidayName(t);
      const type = hol ? 'holiday' : (dow === 0 || dow === 6 ? 'weekend' : 'work');
      days.push({ t, dow, type, holiday: hol });
    }
    return days;
  }

  /* ---------- Walidacja ---------- */
  function readInput() {
    const errors = [];
    document.querySelectorAll('input.invalid').forEach((el) => el.classList.remove('invalid'));
    const bad = (id, msg) => { $(id).classList.add('invalid'); errors.push(msg); };

    const from = parseDate($('dateFrom').value);
    const to = parseDate($('dateTo').value);
    if (from == null) bad('dateFrom', 'Podaj datę ostatniego odczytu.');
    if (to == null) bad('dateTo', 'Podaj datę najnowszego odczytu.');
    if (from != null && to != null && to <= from) bad('dateTo', 'Data najnowszego odczytu musi być późniejsza niż data ostatniego odczytu.');
    if (from != null && to != null && (to - from) / DAY_MS > 3700) bad('dateTo', 'Okres jest zbyt długi (maks. ok. 10 lat).');

    const days = (errors.length === 0) ? buildDays(from, to) : [];
    const meters = [];

    for (let i = 1; i <= METER_COUNT; i++) {
      const name = $(`m${i}-name`).value.trim() || `Licznik ${i}`;
      const s = parseNum($(`m${i}-start`).value);
      const e = parseNum($(`m${i}-end`).value);
      const m = parseNum($(`m${i}-max`).value);
      if (s === null && e === null) continue; // pusty licznik
      let ok = true;
      if (s === null || Number.isNaN(s)) { bad(`m${i}-start`, `${name}: podaj poprawny stan początkowy.`); ok = false; }
      if (e === null || Number.isNaN(e)) { bad(`m${i}-end`, `${name}: podaj poprawny stan końcowy.`); ok = false; }
      if (Number.isNaN(m) || (m !== null && m <= 0)) { bad(`m${i}-max`, `${name}: maksymalne dzienne zużycie musi być liczbą większą od zera.`); ok = false; }
      if (ok && e < s) { bad(`m${i}-end`, `${name}: stan końcowy nie może być mniejszy niż początkowy.`); ok = false; }
      // limit liczony w pełnych m³, bo raport pokazuje pełne m³ (wtedy żadna wartość w tabeli go nie przekroczy)
      const cap = m === null ? Infinity : Math.floor(m + 1e-9);
      if (ok && m !== null && cap < 1 && e - s > 0) { bad(`m${i}-max`, `${name}: limit dzienny musi wynosić co najmniej 1 m³.`); ok = false; }
      if (ok && days.length && Number.isFinite(cap) && (e - s) > cap * days.length + 1e-9) {
        bad(`m${i}-max`, `${name}: zużycie ${fmt(e - s)} m³ nie zmieści się w ${days.length} dniach przy limicie ${fmt(cap)} m³/dzień (maks. ${fmt(cap * days.length)} m³). Zwiększ limit lub sprawdź odczyty.`);
        ok = false;
      }
      if (ok) meters.push({ name, start: s, end: e, cap, capRaw: m });
    }

    if (errors.length === 0 && meters.length === 0) errors.push('Uzupełnij co najmniej jeden licznik (stan początkowy i końcowy).');
    return { errors, from, to, days, meters };
  }

  /* ---------- Algorytm rozkładu ---------- */
  // 1) wagi dni: dzień roboczy ≈ 1, weekend/święto ≈ 1,2–1,3, plus lekki szum
  // 2) podział proporcjonalny z limitem dziennym (wyrównywanie „water-filling”)
  // 3) zaokrąglenie do 0,01 m³ (jednostki = setne m³) metodą największych reszt z zachowaniem sumy i limitów
  function makeWeights(days) {
    return days.map((d) => {
      const base = d.type === 'work' ? 1 : rand(WEEKEND_MIN, WEEKEND_MAX);
      return base * rand(1 - NOISE, 1 + NOISE);
    });
  }

  function allocate(total, weights, cap) {
    const n = weights.length;
    const x = new Array(n).fill(0);
    const fixed = new Array(n).fill(false);
    let remaining = total;
    for (let guard = 0; guard <= n; guard++) {
      let W = 0;
      for (let i = 0; i < n; i++) if (!fixed[i]) W += weights[i];
      if (W === 0) break;
      let changed = false;
      for (let i = 0; i < n; i++) {
        if (!fixed[i] && remaining * weights[i] / W > cap[i]) { x[i] = cap[i]; fixed[i] = true; changed = true; }
      }
      if (changed) {
        remaining = total;
        for (let i = 0; i < n; i++) if (fixed[i]) remaining -= x[i];
        continue;
      }
      for (let i = 0; i < n; i++) if (!fixed[i]) x[i] = remaining * weights[i] / W;
      break;
    }
    return x;
  }

  function toIntegers(x, totalInt, cap, weights) {
    const n = x.length;
    const out = x.map((v, i) => Math.min(cap[i], Math.floor(v + 1e-9)));
    let rest = totalInt - out.reduce((a, b) => a + b, 0);
    const order = x.map((v, i) => i).sort((a, b) => {
      const fa = x[a] - Math.floor(x[a] + 1e-9), fb = x[b] - Math.floor(x[b] + 1e-9);
      return (fb - fa) || (weights[b] - weights[a]);
    });
    // dodawaj po 1 m³ dniom z największą resztą, potem wg wag
    for (let pass = 0; rest > 0 && pass < 1000; pass++) {
      let progressed = false;
      for (const i of order) {
        if (rest <= 0) break;
        if (out[i] + 1 <= cap[i]) { out[i]++; rest--; progressed = true; }
      }
      if (!progressed) break;
      order.sort((a, b) => weights[b] - weights[a]);
    }
    return out;
  }

  // Rozkład liczony z dokładnością 0,01 m³; w raporcie stany są zaokrąglane do pełnych m³,
  // a zużycie dzienne = różnica zaokrąglonych stanów (tabela zawsze się „spina”).
  // Limit dzienny: w zwykłe dni obowiązuje limit obniżony o 1–3% (w pełnych m³),
  // a pełna wartość limitu może wystąpić tylko sporadycznie – ok. raz na 30 dni
  // (więcej razy tylko wtedy, gdy bez tego nie da się rozłożyć zużycia).
  function buildCaps(meter, days, totalU) {
    const n = days.length;
    if (!Number.isFinite(meter.cap)) return new Array(n).fill(Infinity);
    const L = meter.cap;
    const reduced = days.map(() => {
      const r = Math.floor(L * (1 - rand(0.01, 0.03)) + 1e-9);
      return L > 1 ? Math.min(r, L - 1) : L;   // zawsze poniżej limitu (o ile limit > 1)
    });
    const capsU = reduced.map((c) => c * 100);
    // kolejność dni, które mogą dostać pełny limit: najpierw losowe weekendy/święta, potem pozostałe
    const order = days.map((d, i) => i).sort(() => Math.random() - 0.5)
      .sort((a, b) => (days[a].type === 'work') - (days[b].type === 'work'));
    let allowed = Math.max(1, Math.round(n / 30));
    const sum = () => capsU.reduce((a, b) => a + b, 0);
    let k = 0;
    for (; k < Math.min(allowed, n); k++) capsU[order[k]] = L * 100;
    while (sum() < totalU && k < n) { capsU[order[k]] = L * 100; k++; }
    return capsU;
  }

  // Rozkład liczony z dokładnością 0,01 m³; w raporcie stany są zaokrąglane do pełnych m³,
  // a zużycie dzienne = różnica zaokrąglonych stanów (tabela zawsze się „spina”).
  function distribute(meter, days) {
    const startU = Math.round(meter.start * 100);
    const endU = Math.round(meter.end * 100);
    const totalU = endU - startU;
    const capU = buildCaps(meter, days, totalU);
    const weights = makeWeights(days);
    const x = allocate(totalU, weights, capU);
    const dailyU = toIntegers(x, totalU, capU, weights);
    let stateU = startU;
    const exact = dailyU.map((v) => (stateU += v) / 100);          // stany dokładne (0,01 m³)
    const states = exact.map((v) => Math.round(v));                // stany w raporcie (pełne m³)
    const startR = Math.round(meter.start);
    const daily = states.map((s, i) => s - (i === 0 ? startR : states[i - 1]));
    return { daily, states, startR, endR: states[states.length - 1] };
  }

  /* ---------- Render ---------- */
  let last = null;

  function render(input) {
    const { days, meters, from, to } = input;
    const results = meters.map((m) => ({ meter: m, ...distribute(m, days) }));
    last = input;

    const free = days.filter((d) => d.type !== 'work').length;
    $('resultInfo').textContent =
      `Okres ${plDate(from)} – ${plDate(to)} · ${days.length} dni zużycia (${days.length - free} roboczych, ${free} weekendowych/świątecznych). Wartości w m³.`;

    // tabela
    let h = '<thead><tr><th class="sticky-col" rowspan="2">Data</th>';
    results.forEach((r) => { h += `<th colspan="2" class="group first-in-group">${esc(r.meter.name)}</th>`; });
    h += '</tr><tr>';
    results.forEach(() => { h += '<th class="first-in-group">stan</th><th>zużycie</th>'; });
    h += '</tr></thead><tbody>';

    const fDow = new Date(from).getUTCDay();
    const fHol = holidayName(from);
    const fCls = fHol ? 'holiday' : (fDow === 0 || fDow === 6 ? 'weekend' : '');
    h += `<tr class="${fCls}"><td class="sticky-col">${plDate(from)} <span class="daytype">${WEEKDAYS_SHORT[fDow]}${fHol ? ' · ' + esc(fHol) : ''}</span></td>`;
    results.forEach((r) => { h += `<td class="num state first-in-group">${fmt(r.startR)}</td><td class="num use"></td>`; });
    h += '</tr>';

    days.forEach((d, i) => {
      const label = d.holiday ? d.holiday : WEEKDAYS[d.dow];
      const cls = d.type === 'work' ? '' : d.type;
      h += `<tr class="${cls}" title="${esc(label)}"><td class="sticky-col">${plDate(d.t)} <span class="daytype">${WEEKDAYS_SHORT[d.dow]}${d.holiday ? ' · ' + esc(d.holiday) : ''}</span></td>`;
      results.forEach((r) => {
        h += `<td class="num state first-in-group">${fmt(r.states[i])}</td><td class="num use">${fmt(r.daily[i])}</td>`;
      });
      h += '</tr>';
    });

    h += '<tr class="total"><td class="sticky-col">Razem</td>';
    results.forEach((r) => {
      h += `<td class="num first-in-group"></td><td class="num">${fmt(r.endR - r.startR)}</td>`;
    });
    h += '</tr></tbody>';

    $('table').innerHTML = h;
    $('result').hidden = false;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showErrors(errors) {
    const box = $('errors');
    if (!errors.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = '<ul>' + errors.map((e) => `<li>${esc(e)}</li>`).join('') + '</ul>';
    box.hidden = false;
  }

  /* ---------- Zdarzenia ---------- */
  function onSubmit(ev) {
    ev.preventDefault();
    saveForm();
    const input = readInput();
    showErrors(input.errors);
    if (input.errors.length) { $('result').hidden = true; return; }
    render(input);
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    buildMeters();
    loadForm();
    updatePeriodInfo();
    $('form').addEventListener('submit', onSubmit);
    $('form').addEventListener('input', () => { saveForm(); updatePeriodInfo(); });
    $('btnReroll').addEventListener('click', () => { if (last) render(last); });
    $('btnPrint').addEventListener('click', () => window.print());
    $('btnReset').addEventListener('click', () => {
      if (!confirm('Wyczyścić wszystkie pola?')) return;
      FIELD_IDS().forEach((id) => { $(id).value = ''; });
      for (let i = 1; i <= METER_COUNT; i++) $(`m${i}-name`).value = `Licznik ${i}`;
      saveForm(); updatePeriodInfo(); showErrors([]);
      document.querySelectorAll('input.invalid').forEach((el) => el.classList.remove('invalid'));
      $('result').hidden = true;
    });
  }

  // eksport dla testów
  window.__rozkladWody = { allocate, toIntegers, holidaysForYear, buildDays };

  document.addEventListener('DOMContentLoaded', init);
})();
