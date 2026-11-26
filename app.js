'use strict';

const view = document.querySelector('#view');
const bank = window.QUESTION_BANK;
const byId = new Map(bank.map(q => [q.id, q]));
const storageKey = 'inspeccion-social-cuaderno-v1';
const labels = {general: 'General', especifico: 'Específico'};
let state = {progress: {}, session: null};
let storageFailed = false;
let block = 'general';

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
  const current = bank.filter(q => q.kind === block && scoreable(q));
  const all = button('Configurar test', () => configure({ block }), 'btn primary');
  filters.append(all, el('small', 'La corrección aparece al finalizar el test.'));

  const tiles = el('div', '', 'tiles');
  for (const theme of [...new Set(current.map(q => q.theme))]) {
    const questions = current.filter(q => q.theme === theme);
    const {seen} = tally(questions);
    const tile = button('', () => configure({ type: 'topics', questions }), 'tile');
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
    const action = button(label + ' · ' + count, () => configure({ type: 'review', questions: bank.filter(q => scoreable(q) && state.progress[q.id]?.[field]), title: label }));
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

const topicKey = q => q.kind + '-' + q.theme;
const topicLabel = q => labels[q.kind] + ' · Tema ' + q.theme;
const format = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

function configure(initial = {}) {
  const bankForTest = bank.filter(scoreable);
  const panel = el('section', '', 'work card');
  const form = el('form', '', 'setup');
  const heading = el('h1', 'Configurar test');
  const selectedTopics = new Set(initial.questions?.map(topicKey) ?? []);
  let type = initial.type ?? 'block';

  function selectField(title, entries, value) {
    const label = el('label', title);
    const input = el('select');
    for (const [key, name] of entries) {
      const option = el('option', name);
      option.value = key;
      input.append(option);
    }
    input.value = value;
    label.append(input);
    return [label, input];
  }

  const types = [['topics', 'Por temas'], ['block', 'Mezclado de un bloque'], ['all', 'Mezclado general y específico']];
  if (initial.questions && type === 'review') types.push(['review', initial.title]);
  const [typeLabel, typeInput] = selectField('Tipo de test', types, type);
  const [blockLabel, blockInput] = selectField('Bloque', Object.entries(labels), initial.block ?? block);
  const topics = el('fieldset', '', 'topic-picker');
  const quantityLabel = el('label', 'Número de preguntas');
  const quantity = el('input');
  quantity.type = 'number';
  quantity.min = '1';
  quantity.step = '1';
  quantity.placeholder = 'Todas';
  quantityLabel.append(quantity);
  const availability = el('small');
  availability.id = 'availability';
  availability.setAttribute('aria-live', 'polite');
  quantity.setAttribute('aria-describedby', availability.id);
  const [penaltyLabel, penalty] = selectField('Penalización por fallo', [
    ['0', 'Sin penalización'], ['third', '−⅓ de un acierto'], ['0.25', '−¼ de un acierto'], ['0.5', '−½ de un acierto'], ['custom', 'Personalizada']
  ], state.penaltyChoice ?? '0');
  const customLabel = el('label', 'Puntos que resta cada fallo');
  const custom = el('input');
  custom.type = 'number';
  custom.min = '0';
  custom.step = 'any';
  custom.value = state.customPenalty ?? '0.2';
  customLabel.append(custom);
  function updatePenalty() {
    customLabel.hidden = penalty.value !== 'custom';
    custom.disabled = customLabel.hidden;
    custom.required = !custom.disabled;
  }
  penalty.addEventListener('change', updatePenalty);
  updatePenalty();

  const launch = el('button', 'Empezar test', 'btn primary');
  launch.type = 'submit';
  function pool() {
    if (type === 'review') return initial.questions;
    if (type === 'all') return bankForTest;
    if (type === 'block') return bankForTest.filter(q => q.kind === blockInput.value);
    return bankForTest.filter(q => selectedTopics.has(topicKey(q)));
  }

  function updateAvailability() {
    const count = pool().length;
    availability.textContent = count ? count + ' disponibles. Deja el campo vacío para incluir todas.' : 'Selecciona al menos un tema.';
    quantity.max = String(count);
    launch.disabled = count === 0;
  }

  function updateType() {
    type = typeInput.value;
    blockLabel.hidden = type !== 'block';
    topics.hidden = type !== 'topics';
    updateAvailability();
  }

  const topicList = el('div', '', 'topic-options');
  const unique = new Map(bankForTest.map(q => [topicKey(q), q]));
  for (const [key, q] of unique) {
    const label = el('label', '', 'topic-option');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = selectedTopics.has(key);
    box.addEventListener('change', () => {
      if (box.checked) selectedTopics.add(key);
      else selectedTopics.delete(key);
      updateAvailability();
    });
    label.append(box, el('span', topicLabel(q)));
    topicList.append(label);
  }
  topics.append(el('legend', 'Temas'), topicList);
  typeInput.addEventListener('change', updateType);
  blockInput.addEventListener('change', updateAvailability);
  updateType();

  const actions = el('div', '', 'actions');
  actions.append(launch, button('Volver', () => { dashboard(); focusHeading(); }));
  form.append(typeLabel, blockLabel, topics, quantityLabel, availability, penaltyLabel, customLabel,
    el('small', 'Cada acierto suma 1 punto. Las preguntas en blanco valen 0.'), actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const questions = pool();
    const limit = quantity.value === '' ? questions.length : quantity.valueAsNumber;
    if (!Number.isInteger(limit) || limit < 1 || limit > questions.length) return;
    const cost = penalty.value === 'third' ? 1 / 3 : penalty.value === 'custom' ? custom.valueAsNumber : Number(penalty.value);
    if (!Number.isFinite(cost) || cost < 0) return;
    const title = type === 'review' ? initial.title
      : type === 'topics' ? (selectedTopics.size === 1 ? topicLabel(questions[0]) : 'Test por temas')
      : type === 'all' ? 'Mixto general y específico' : labels[blockInput.value] + ' · mixto';
    start(questions, title, { mix: type === 'block' || type === 'all' || limit < questions.length || (type === 'topics' && selectedTopics.size > 1), limit, penalty: cost, penaltyChoice: penalty.value, customPenalty: custom.value });
  });
  panel.append(heading, form);
  render(panel);
  focusHeading();
}

function start(questions, title, { mix = false, limit = questions.length, penalty = 0, penaltyChoice = '0', customPenalty = '0.2' } = {}) {
  if (!questions.length) return;
  if (state.session && !state.session.done && !window.confirm('¿Sustituir la sesión en curso por este test?')) return;
  const ids = questions.map(q => q.id);
  if (mix) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  state.penaltyChoice = penaltyChoice;
  state.customPenalty = customPenalty;
  state.session = {ids: ids.slice(0, limit), title, penalty, index: 0, answers: {}, done: false};
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
    const choice = button('', () => {
      session.answers[q.id] = key;
      save();
      sessionView(key);
    }, key === selection ? 'answer selected' : 'answer');
    choice.append(el('span', key.toUpperCase()), el('span', text));
    choice.dataset.option = key;
    choice.setAttribute('aria-pressed', String(key === selection));
    answers.append(choice);
  }
  card.append(answers);
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
  if (focusOption) view.querySelector('[data-option="' + focusOption + '"]').focus();
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
  const penalty = session.penalty ?? 0;
  const points = correct - (wrong.length ? wrong.length * penalty : 0);
  const grade = 10 * (Math.max(0, points) / questions.length);
  const stats = el('dl', '', 'score-grid');
  for (const [label, value] of [
    ['Nota estimada', format.format(grade) + ' / 10'],
    ['Aciertos', correct + ' / ' + questions.length],
    ['Fallos', String(wrong.length)],
    ['En blanco', String(blank)]
  ]) {
    const metric = el('div');
    metric.append(el('dt', label), el('dd', value));
    stats.append(metric);
  }
  const penaltyText = penalty === 1 / 3 ? '⅓' : format.format(penalty);
  report.append(el('h1', 'Resultado del test'), el('p', session.title, 'muted'), stats,
    el('p', 'Aciertos sobre el total: ' + format.format(100 * correct / questions.length) + ' %.'),
    el('p', 'Puntuación neta: ' + format.format(points) + ' de ' + questions.length + ' puntos. Penalización: ' + penaltyText + ' puntos por fallo. La nota se convierte a escala de 0 a 10.', 'muted'),
    topicResults(questions, session.answers));
  const actions = el('div', '', 'actions');
  actions.append(button('Volver al inicio', () => { dashboard(); focusHeading(); }, 'btn primary'));
  if (wrong.length) actions.append(button('Repetir fallos', () => configure({ type: 'review', questions: wrong, title: 'Fallos del último test' })));
  report.append(actions);
  for (const q of questions) {
    const detail = el('details');
    const pick = session.answers[q.id];
    const status = pick === q.correct ? 'Correcta' : pick ? 'Incorrecta' : 'En blanco';
    detail.append(el('summary', status + ' · Tema ' + q.theme + ' / ' + q.number + ' · ' + q.text));
    const options = el('ul', '', 'solution-options');
    for (const [key, value] of Object.entries(q.options)) {
      const isCorrect = key === q.correct;
      const isSelected = key === pick;
      const style = isCorrect ? ' correct' : isSelected ? ' incorrect' : '';
      const option = el('li', '', 'solution-option' + style);
      option.append(el('strong', key.toUpperCase() + ' · '), el('span', value));
      if (isCorrect || isSelected) {
        const label = isCorrect && isSelected ? '✓ Correcta · Tu respuesta'
          : isCorrect ? '✓ Correcta' : '✗ Tu respuesta';
        option.append(el('span', label, 'solution-label'));
      }
      options.append(option);
    }
    detail.append(options);
    report.append(detail);
  }
  render(report);
}

function topicResults(questions, answers) {
  const section = el('section', '', 'topic-results');
  const topics = new Map();
  for (const q of questions) {
    const key = topicKey(q);
    if (!topics.has(key)) topics.set(key, { label: topicLabel(q), total: 0, correct: 0, wrong: 0, blank: 0 });
    const entry = topics.get(key);
    entry.total++;
    const pick = answers[q.id];
    if (!pick) entry.blank++;
    else if (pick === q.correct) entry.correct++;
    else entry.wrong++;
  }
  const table = el('table');
  table.append(el('caption', 'Resultados por tema'));
  const header = el('tr');
  for (const name of ['Tema', 'Aciertos', 'Fallos', 'En blanco']) {
    const cell = el('th', name);
    cell.scope = 'col';
    header.append(cell);
  }
  const head = el('thead');
  head.append(header);
  const body = el('tbody');
  for (const entry of topics.values()) {
    const row = el('tr');
    const label = el('th', entry.label);
    label.scope = 'row';
    row.append(label, el('td', entry.correct + ' / ' + entry.total), el('td', String(entry.wrong)), el('td', String(entry.blank)));
    body.append(row);
  }
  table.append(head, body);
  section.append(table);
  return section;
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
