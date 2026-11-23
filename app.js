'use strict';

const view = document.querySelector('#view');
const bank = window.QUESTION_BANK;
const byId = new Map(bank.map(q => [q.id, q]));
const storageKey = 'inspeccion-social-cuaderno-v1';
const labels = {general: 'General', especifico: 'Específico'};
let state = {progress: {}, session: null};
let storageFailed = false;
let block = 'general';
let mode = 'study';

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved?.progress && typeof saved.progress === 'object') state = saved;
} catch {
  storageFailed = true;
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    storageFailed = true;
  }
}

function el(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function button(label, handler, style = 'btn') {
  const node = el('button', label, style);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function render(...nodes) {
  if (storageFailed) {
    nodes.unshift(el('p', 'El progreso se conserva mientras esta pestaña siga abierta. Comprueba si el navegador permite el almacenamiento local.', 'notice'));
  }
  view.replaceChildren(...nodes);
}

function focusHeading() {
  const heading = view.querySelector('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({preventScroll: true});
  }
  window.scrollTo(0, 0);
}

function scoreable(q) {
  return !q.issue && Boolean(q.correct && q.options[q.correct]);
}

function tally(questions) {
  return questions.reduce((total, q) => {
    const record = state.progress[q.id];
    if (record?.seen) total.seen++;
    if (record?.wrong) total.wrong++;
    if (record?.marked) total.marked++;
    return total;
  }, {seen: 0, wrong: 0, marked: 0});
}

function optionsMenu(title, pairs, value) {
  const label = el('label', title);
  const select = el('select');
  for (const [key, name] of pairs) {
    const option = el('option', name);
    option.value = key;
    option.selected = key === value;
    select.append(option);
  }
  label.append(select);
  return {label, select};
}

function dashboard() {
  const totals = tally(bank);
  const hero = el('section', '', 'hero');
  const intro = el('div');
  intro.append(el('h1', 'Practica por temas'), el('p', 'Tests de Inspección de Servicios Sociales · Comunidad de Madrid'));
  const metrics = el('div', '', 'metrics');
  for (const [amount, label] of [[bank.length, 'Preguntas'], [totals.seen, 'Respondidas'], [totals.wrong, 'Fallos pendientes']]) {
    const metric = el('div', '', 'metric');
    metric.append(el('strong', String(amount)), el('span', label));
    metrics.append(metric);
  }
  hero.append(intro, metrics);

  const layout = el('div', '', 'layout');
  const topics = el('section', '', 'card');
  const tabs = el('div', '', 'tabs');
  for (const [key, label] of Object.entries(labels)) {
    const tab = button(label, () => { block = key; dashboard(); view.querySelector('.tab.active').focus(); }, 'tab' + (key === block ? ' active' : ''));
    tab.setAttribute('aria-pressed', String(key === block));
    tabs.append(tab);
  }
  const filters = el('div', '', 'filters');
  const menu = optionsMenu('Modo', [['study', 'Estudio · corrección al responder'], ['exam', 'Simulacro · corrección al finalizar']], mode);
  menu.select.addEventListener('change', () => { mode = menu.select.value; });
  filters.append(menu.label);
  const current = bank.filter(q => q.kind === block && scoreable(q));
  const all = button('Mezclar bloque', () => start(current, labels[block] + ' · mixto', mode, true), 'btn primary');
  filters.append(all);

  const tiles = el('div', '', 'tiles');
  for (const theme of [...new Set(current.map(q => q.theme))]) {
    const questions = current.filter(q => q.theme === theme);
    const {seen} = tally(questions);
    const tile = button('', () => start(questions, labels[block] + ' · Tema ' + theme, mode), 'tile');
    const bar = el('progress');
    bar.max = questions.length;
    bar.value = seen;
    bar.setAttribute('aria-label', 'Progreso del tema ' + theme);
    tile.append(el('strong', 'Tema ' + theme), el('small', seen + ' / ' + questions.length + ' respondidas'), bar);
    tiles.append(tile);
  }
  topics.append(el('h2', 'Temario'), tabs, filters, tiles);

  const side = el('aside', '', 'side');
  if (state.session && !state.session.done) {
    const resume = el('section', '', 'card');
    resume.append(el('h2', 'Sesión en curso'), el('p', state.session.title + ' · ' + Object.keys(state.session.answers).length + ' respondidas', 'muted'),
      button('Continuar sesión', () => { sessionView(); focusHeading(); }, 'btn primary'));
    side.append(resume);
  }
  const practice = el('section', '', 'card');
  practice.append(el('h2', 'Repaso personal'), el('p', 'Vuelve a tus fallos o a las preguntas que has marcado.', 'muted'));
  for (const [field, label, count] of [['wrong', 'Repasar fallos', totals.wrong], ['marked', 'Ver marcadas', totals.marked]]) {
    const action = button(label + ' · ' + count, () => start(bank.filter(q => scoreable(q) && state.progress[q.id]?.[field]), label, 'study'));
    action.disabled = count === 0;
    practice.append(action);
  }
  if (state.session?.done) practice.append(button('Último resultado', () => { results(); focusHeading(); }));
  const review = el('section', '', 'card');
  const flagged = bank.filter(q => !scoreable(q));
  review.append(el('h2', 'Plantilla de respuestas'), el('p', 'El CSV del bloque específico está pendiente de segunda revisión.', 'muted'));
  if (flagged.length) review.append(button('Ver discrepancias · ' + flagged.length, () => { reviewView(flagged); focusHeading(); }));
  side.append(practice, review);
  layout.append(topics, side);
  render(hero, layout);
}

function start(questions, title, sessionMode, mix = false) {
  if (!questions.length) return;
  if (state.session && !state.session.done && !window.confirm('¿Sustituir la sesión en curso por este test?')) return;
  const ids = questions.map(q => q.id);
  if (mix) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  state.session = {ids, title, mode: sessionMode, index: 0, answers: {}, done: false};
  save();
  sessionView();
  focusHeading();
}

function recordAnswer(q, value) {
  const record = state.progress[q.id] ??= {};
  record.seen = true;
  record.wrong = value !== q.correct;
}

function sessionView(focusOption) {
  const session = state.session;
  if (session.done) return results();
  const q = byId.get(session.ids[session.index]);
  const selection = session.answers[q.id];
  const corrected = Boolean(selection && session.mode === 'study');
  const work = el('section', '', 'work');
  const header = el('div', '', 'session-head');
  header.append(el('h1', session.title), button('Inicio', () => { dashboard(); focusHeading(); }));
  const progress = el('progress');
  progress.max = session.ids.length;
  progress.value = Object.keys(session.answers).length;
  progress.setAttribute('aria-label', 'Preguntas respondidas');
  const card = el('article', '', 'card question');
  card.append(el('p', 'Pregunta ' + (session.index + 1) + ' de ' + session.ids.length + ' · ' + labels[q.kind] + ' · Tema ' + q.theme + ' / ' + q.number, 'qmeta'), el('h2', q.text));

  const answers = el('div', '', 'answers');
  for (const [key, text] of Object.entries(q.options)) {
    let style = 'answer';
    if (corrected && key === q.correct) style += ' good';
    else if (corrected && key === selection) style += ' bad';
    else if (key === selection) style += ' selected';
    const choice = button('', () => {
      session.answers[q.id] = key;
      if (session.mode === 'study') recordAnswer(q, key);
      save();
      sessionView(key);
    }, style);
    choice.append(el('span', key.toUpperCase()), el('span', text));
    choice.dataset.option = key;
    choice.setAttribute('aria-pressed', String(key === selection));
    choice.disabled = corrected;
    answers.append(choice);
  }
  card.append(answers);
  if (corrected) {
    const feedback = el('p', selection === q.correct ? 'Correcta.' : 'Respuesta de la plantilla: ' + q.correct.toUpperCase() + '.', 'feedback');
    feedback.tabIndex = -1;
    card.append(feedback);
  }
  const actions = el('div', '', 'actions');
  const mark = button(state.progress[q.id]?.marked ? 'Quitar marca' : 'Marcar para repasar', event => {
    const record = state.progress[q.id] ??= {};
    record.marked = !record.marked;
    event.currentTarget.textContent = record.marked ? 'Quitar marca' : 'Marcar para repasar';
    event.currentTarget.setAttribute('aria-pressed', String(record.marked));
    save();
  });
  mark.setAttribute('aria-pressed', String(Boolean(state.progress[q.id]?.marked)));
  const previous = button('Anterior', () => go(-1));
  const next = button('Siguiente', () => go(1));
  previous.disabled = session.index === 0;
  next.disabled = session.index === session.ids.length - 1;
  actions.append(previous, next, mark, button('Finalizar', finish, 'btn primary end'));
  card.append(actions);
  work.append(header, progress, card);
  render(work);
  if (focusOption) view.querySelector(corrected ? '.feedback' : '[data-option="' + focusOption + '"]').focus();
}

function go(offset) {
  state.session.index += offset;
  save();
  sessionView();
  const question = view.querySelector('h2');
  question.tabIndex = -1;
  question.focus();
}

function finish() {
  const session = state.session;
  const unanswered = session.ids.length - Object.keys(session.answers).length;
  if (unanswered && !window.confirm('Quedan ' + unanswered + ' preguntas sin responder. ¿Finalizar el test?')) return;
  for (const [id, value] of Object.entries(session.answers)) recordAnswer(byId.get(id), value);
  session.done = true;
  save();
  results();
  focusHeading();
}

function results() {
  const session = state.session;
  const questions = session.ids.map(id => byId.get(id));
  const correct = questions.filter(q => session.answers[q.id] === q.correct).length;
  const wrong = questions.filter(q => session.answers[q.id] && session.answers[q.id] !== q.correct);
  const blank = questions.length - correct - wrong.length;
  const report = el('section', '', 'work card results');
  report.append(el('h1', 'Resultado del test'), el('p', session.title, 'muted'),
    el('p', correct + ' aciertos de ' + questions.length + ' · ' + wrong.length + ' fallos · ' + blank + ' en blanco'));
  const actions = el('div', '', 'actions');
  actions.append(button('Volver al inicio', () => { dashboard(); focusHeading(); }, 'btn primary'));
  if (wrong.length) actions.append(button('Repetir fallos', () => start(wrong, 'Fallos del último test', 'study')));
  report.append(actions);
  for (const q of questions) {
    const detail = el('details');
    const pick = session.answers[q.id];
    const status = pick === q.correct ? 'Correcta' : pick ? 'Incorrecta' : 'En blanco';
    detail.append(el('summary', status + ' · Tema ' + q.theme + ' / ' + q.number + ' · ' + q.text),
      el('p', 'Tu respuesta: ' + (pick ? pick.toUpperCase() + ' · ' + q.options[pick] : 'En blanco')),
      el('p', 'Plantilla: ' + q.correct.toUpperCase() + ' · ' + q.options[q.correct]));
    report.append(detail);
  }
  render(report);
}

function reviewView(questions) {
  const panel = el('section', '', 'work card results');
  panel.append(el('h1', 'Respuestas por verificar'), el('p', 'Estas preguntas quedan fuera de los tests hasta resolver la discrepancia.'), button('Volver al inicio', () => { dashboard(); focusHeading(); }));
  for (const q of questions) {
    const row = el('article', '', 'review-item');
    row.append(el('h2', labels[q.kind] + ' · Tema ' + q.theme + ' / ' + q.number), el('p', q.text));
    const list = el('ul');
    for (const [key, value] of Object.entries(q.options)) list.append(el('li', key.toUpperCase() + ' · ' + value));
    row.append(list);
    if (q.alternative) row.append(el('p', 'CSV: ' + q.correct.toUpperCase() + ' · Texto: ' + q.alternative.toUpperCase() + ' · Página de soluciones: ' + q.page));
    panel.append(row);
  }
  render(panel);
}

document.querySelector('#home').addEventListener('click', () => { dashboard(); focusHeading(); });
dashboard();
