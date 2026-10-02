import {
  applyProposal,
  extractCandidates,
  fieldValue,
  findDuplicate,
  inferSchema,
  recommendChart,
  sortItems,
  stableHash,
} from './engine.js';
import { SAMPLE_THREAD } from './sample.js';

const STORAGE_KEY = 'thread-atlas:v1';
const state = loadState();

const els = {
  sourceInput: document.querySelector('#source-input'),
  analyze: document.querySelector('#analyze'),
  sample: document.querySelector('#sample'),
  clear: document.querySelector('#clear-workspace'),
  review: document.querySelector('#review-queue'),
  reviewCount: document.querySelector('#review-count'),
  datasetCount: document.querySelector('#dataset-count'),
  sourceCount: document.querySelector('#source-count'),
  suspiciousCount: document.querySelector('#suspicious-count'),
  table: document.querySelector('#dataset-table'),
  chart: document.querySelector('#chart'),
  chartTitle: document.querySelector('#chart-title'),
  chartReason: document.querySelector('#chart-reason'),
  viewButtons: [...document.querySelectorAll('[data-view]')],
  panels: [...document.querySelectorAll('[data-panel]')],
  search: document.querySelector('#dataset-search'),
  groupBy: document.querySelector('#group-by'),
  chartType: document.querySelector('#chart-type'),
  chartX: document.querySelector('#chart-x'),
  chartY: document.querySelector('#chart-y'),
  groups: document.querySelector('#groups'),
  sources: document.querySelector('#source-ledger'),
  activity: document.querySelector('#activity-log'),
  schema: document.querySelector('#schema-chips'),
  empty: document.querySelector('#empty-state'),
  privacy: document.querySelector('#storage-mode'),
};

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed || { items: [], proposals: [], sources: [], events: [], activeView: 'review' };
  } catch {
    return { items: [], proposals: [], sources: [], events: [], activeView: 'review' };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function record(event) {
  state.events.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...event });
  state.events = state.events.slice(0, 100);
}

function analyzeSource(text) {
  const sourceId = `src-${stableHash(text)}`;
  if (state.sources.some((source) => source.id === sourceId)) {
    record({ type: 'source.skipped', label: 'Duplicate source ignored', sourceId });
    return;
  }
  const result = extractCandidates(text, sourceId);
  if (!result.source) return;
  state.sources.unshift(result.source);
  state.proposals.push(...result.proposals.map((proposal) => ({ ...proposal, status: 'pending' })));
  record({ type: 'source.analyzed', label: `${result.proposals.length} proposals extracted`, sourceId });
  state.activeView = 'review';
  persist();
  render();
}

function decide(proposalId, action) {
  const proposal = state.proposals.find((p) => p.proposalId === proposalId);
  if (!proposal || proposal.status !== 'pending') return;
  const before = state.items.length;
  const result = applyProposal(proposal, state.items, action);
  state.items = result.items;
  proposal.status = action === 'accept' ? 'accepted' : 'rejected';
  const duplicate = findDuplicate(proposal, state.items.filter((item) => !item.provenance?.some((p) => p.sourceHash === proposal.evidence.sourceHash)));
  record({ ...result.event, label: action === 'accept' ? (state.items.length === before ? 'Merged into existing item' : 'Added to dataset') : 'Proposal rejected', duplicate });
  persist();
  render();
}

function pendingProposals() {
  return state.proposals.filter((proposal) => proposal.status === 'pending');
}

function schema() {
  return inferSchema(state.items, pendingProposals());
}

function setView(view) {
  state.activeView = view;
  persist();
  renderView();
}

function renderView() {
  for (const button of els.viewButtons) button.classList.toggle('active', button.dataset.view === state.activeView);
  for (const panel of els.panels) panel.hidden = panel.dataset.panel !== state.activeView;
}

function fieldDisplay(field) {
  if (!field) return '—';
  if (field.type === 'range') return `${field.value.min}–${field.value.max}${field.unit ? ` ${field.unit}` : ''}`;
  if (field.type === 'number' && field.unit) return `${field.unit === '$' ? field.unit : ''}${Number(field.value).toLocaleString()}${field.unit !== '$' ? ` ${field.unit}` : ''}`;
  return String(field.value);
}

function renderReview() {
  const pending = pendingProposals();
  els.reviewCount.textContent = pending.length;
  if (!pending.length) {
    els.review.innerHTML = `<div class="soft-empty"><span>✓</span><strong>Review queue is clear</strong><p>Analyze a discussion to create structured proposals.</p></div>`;
    return;
  }
  els.review.innerHTML = pending.map((proposal) => {
    const duplicate = findDuplicate(proposal, state.items);
    const fields = Object.entries(proposal.fields).map(([key, field]) => `
      <div class="field-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(fieldDisplay(field))}</strong><button class="provenance" title="${escapeHtml(field.evidence.excerpt)}">source</button></div>`).join('');
    return `<article class="proposal-card ${proposal.security.suspicious ? 'security-flag' : ''}">
      <div class="proposal-head">
        <div><span class="eyebrow">${escapeHtml(proposal.evidence.author)}</span><h3>${escapeHtml(proposal.name)}</h3></div>
        <span class="confidence">${Math.round(proposal.confidence * 100)}% structured</span>
      </div>
      ${duplicate ? `<div class="merge-note">↻ Possible update: ${escapeHtml(duplicate.reason)}</div>` : ''}
      ${proposal.security.suspicious ? `<div class="security-note">Shielded source text contains instruction-like content. It is treated only as data.</div>` : ''}
      <div class="field-list">${fields || '<span class="muted">No typed fields detected</span>'}</div>
      <details><summary>Evidence</summary><p>${escapeHtml(proposal.evidence.excerpt)}</p><code>${proposal.evidence.sourceHash}</code></details>
      <div class="proposal-actions"><button class="ghost" data-reject="${proposal.proposalId}">Reject</button><button class="primary" data-accept="${proposal.proposalId}">${duplicate ? 'Review & merge' : 'Add item'}</button></div>
    </article>`;
  }).join('');
  els.review.querySelectorAll('[data-accept]').forEach((button) => button.addEventListener('click', () => decide(button.dataset.accept, 'accept')));
  els.review.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => decide(button.dataset.reject, 'reject')));
}

function filteredItems() {
  const q = els.search.value.trim().toLowerCase();
  if (!q) return state.items;
  return state.items.filter((item) => `${item.name} ${Object.values(item.fields).map((f) => f.raw).join(' ')}`.toLowerCase().includes(q));
}

function renderSchema() {
  const fields = schema();
  els.schema.innerHTML = fields.length ? fields.map((field) => `<span class="schema-chip"><b>${escapeHtml(field.key)}</b><small>${field.type}</small></span>`).join('') : '<span class="muted">Schema appears as evidence is accepted.</span>';
}

function renderTable() {
  const fields = inferSchema(state.items, []);
  const items = sortItems(filteredItems(), fields.find((f) => f.key === 'upvotes')?.key || 'name', 'desc');
  if (!items.length) {
    els.table.innerHTML = '<div class="soft-empty">No accepted items yet.</div>';
    return;
  }
  const keys = fields.map((field) => field.key);
  els.table.innerHTML = `<div class="table-scroll"><table><thead><tr><th>Item</th>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('')}<th>Evidence</th></tr></thead><tbody>
    ${items.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.normalizedName)}</small></td>${keys.map((key) => `<td>${escapeHtml(fieldDisplay(item.fields[key]))}</td>`).join('')}<td><span class="evidence-pill">${item.provenance?.length || 0} source${item.provenance?.length === 1 ? '' : 's'}</span></td></tr>`).join('')}
  </tbody></table></div>`;
}

function syncControls() {
  const fields = inferSchema(state.items, []);
  const strings = fields.filter((field) => field.type === 'string');
  const numerics = fields.filter((field) => field.type === 'number');
  const groupCurrent = els.groupBy.value;
  els.groupBy.innerHTML = `<option value="">No grouping</option>${strings.map((field) => `<option value="${field.key}">${field.key}</option>`).join('')}`;
  if ([...els.groupBy.options].some((o) => o.value === groupCurrent)) els.groupBy.value = groupCurrent;

  const xCurrent = els.chartX.value;
  const yCurrent = els.chartY.value;
  els.chartX.innerHTML = `<option value="name">name</option>${fields.map((field) => `<option value="${field.key}">${field.key}</option>`).join('')}`;
  els.chartY.innerHTML = numerics.map((field) => `<option value="${field.key}">${field.key}</option>`).join('');
  const recommended = recommendChart(fields, state.items);
  if (!els.chartType.dataset.touched) els.chartType.value = recommended.type === 'scatter' ? 'scatter' : 'bar';
  if ([...els.chartX.options].some((o) => o.value === xCurrent)) els.chartX.value = xCurrent;
  else if (recommended.x && [...els.chartX.options].some((o) => o.value === recommended.x)) els.chartX.value = recommended.x;
  if ([...els.chartY.options].some((o) => o.value === yCurrent)) els.chartY.value = yCurrent;
  else if (recommended.y && [...els.chartY.options].some((o) => o.value === recommended.y)) els.chartY.value = recommended.y;
  els.chartReason.textContent = recommended.reason;
}

function renderGroups() {
  const key = els.groupBy.value;
  if (!key) {
    els.groups.innerHTML = '<div class="soft-empty">Choose a categorical field to group accepted items.</div>';
    return;
  }
  const groups = new Map();
  for (const item of filteredItems()) {
    const label = String(fieldValue(item, key) || 'Unspecified');
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  els.groups.innerHTML = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([label, items]) => `<section class="group-card"><div class="group-head"><h3>${escapeHtml(label)}</h3><span>${items.length}</span></div>${items.map((item) => `<div class="group-item"><strong>${escapeHtml(item.name)}</strong><small>${item.fields?.upvotes?.value ? `${item.fields.upvotes.value} upvotes` : 'accepted item'}</small></div>`).join('')}</section>`).join('');
}

function renderChart() {
  const items = filteredItems();
  const type = els.chartType.value;
  const xKey = els.chartX.value || 'name';
  const yKey = els.chartY.value;
  els.chartTitle.textContent = `${capitalize(type)} · ${xKey}${yKey ? ` × ${yKey}` : ''}`;
  if (!items.length || !yKey) {
    els.chart.innerHTML = '<div class="soft-empty">Accept items with numeric fields to visualize the collection.</div>';
    return;
  }
  if (type === 'scatter') renderScatter(items, xKey, yKey);
  else renderBars(items, xKey, yKey);
}

function renderBars(items, xKey, yKey) {
  const values = items.map((item) => ({ label: String(fieldValue(item, xKey) || item.name), value: Number(fieldValue(item, yKey) || 0), name: item.name })).filter((d) => Number.isFinite(d.value));
  const max = Math.max(...values.map((d) => d.value), 1);
  els.chart.innerHTML = `<div class="bar-chart">${values.sort((a, b) => b.value - a.value).map((d) => `<div class="bar-row"><span title="${escapeHtml(d.name)}">${escapeHtml(d.label)}</span><div class="bar-track"><i style="width:${Math.max(2, d.value / max * 100)}%"></i></div><b>${d.value.toLocaleString()}</b></div>`).join('')}</div>`;
}

function renderScatter(items, xKey, yKey) {
  const points = items.map((item) => ({ name: item.name, x: Number(fieldValue(item, xKey)), y: Number(fieldValue(item, yKey)) })).filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
  if (!points.length) {
    els.chart.innerHTML = '<div class="soft-empty">Scatter view needs numeric X and Y fields.</div>';
    return;
  }
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const scale = (value, min, max, start, end) => max === min ? (start + end) / 2 : start + ((value - min) / (max - min)) * (end - start);
  els.chart.innerHTML = `<svg class="scatter" viewBox="0 0 760 360" role="img" aria-label="Scatter plot"><line x1="54" y1="18" x2="54" y2="320"/><line x1="54" y1="320" x2="738" y2="320"/>${points.map((p) => `<g><circle cx="${scale(p.x, minX, maxX, 72, 720)}" cy="${scale(p.y, minY, maxY, 298, 34)}" r="8"><title>${escapeHtml(p.name)}: ${p.x}, ${p.y}</title></circle><text x="${scale(p.x, minX, maxX, 72, 720) + 10}" y="${scale(p.y, minY, maxY, 298, 34) - 8}">${escapeHtml(p.name.slice(0, 16))}</text></g>`).join('')}<text x="365" y="350" class="axis-label">${escapeHtml(xKey)}</text><text x="12" y="180" transform="rotate(-90 12 180)" class="axis-label">${escapeHtml(yKey)}</text></svg>`;
}

function renderSources() {
  els.sources.innerHTML = state.sources.length ? state.sources.map((source) => `<article class="source-card"><div><strong>${escapeHtml(source.id)}</strong><small>${new Date(source.createdAt).toLocaleString()}</small></div><span>${source.blockCount} blocks</span><span>${source.bytes.toLocaleString()} bytes</span>${source.suspiciousBlocks ? `<span class="danger">${source.suspiciousBlocks} shielded</span>` : '<span class="safe">clean</span>'}<code>${source.hash}</code><p>${escapeHtml(source.preview)}</p></article>`).join('') : '<div class="soft-empty">No sources analyzed yet.</div>';
}

function renderActivity() {
  els.activity.innerHTML = state.events.length ? state.events.map((event) => `<div class="activity-row"><span class="activity-dot"></span><div><strong>${escapeHtml(event.label || event.type)}</strong><small>${new Date(event.at).toLocaleString()} · ${escapeHtml(event.type)}</small></div></div>`).join('') : '<div class="soft-empty">No revisions yet.</div>';
}

function renderStats() {
  els.datasetCount.textContent = state.items.length;
  els.sourceCount.textContent = state.sources.length;
  els.suspiciousCount.textContent = state.sources.reduce((sum, source) => sum + (source.suspiciousBlocks || 0), 0);
  els.empty.hidden = state.items.length || pendingProposals().length || state.sources.length;
}

function render() {
  renderStats();
  renderReview();
  renderSchema();
  renderTable();
  syncControls();
  renderGroups();
  renderChart();
  renderSources();
  renderActivity();
  renderView();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function capitalize(value = '') { return value.charAt(0).toUpperCase() + value.slice(1); }

els.analyze.addEventListener('click', () => {
  const text = els.sourceInput.value.trim();
  if (text) analyzeSource(text);
});
els.sample.addEventListener('click', () => { els.sourceInput.value = SAMPLE_THREAD; els.sourceInput.focus(); });
els.clear.addEventListener('click', () => {
  if (!confirm('Clear this local ThreadAtlas workspace?')) return;
  state.items = []; state.proposals = []; state.sources = []; state.events = []; state.activeView = 'review';
  localStorage.removeItem(STORAGE_KEY); render();
});
els.viewButtons.forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
els.search.addEventListener('input', () => { renderTable(); renderGroups(); renderChart(); });
els.groupBy.addEventListener('change', renderGroups);
els.chartType.addEventListener('change', () => { els.chartType.dataset.touched = 'true'; renderChart(); });
els.chartX.addEventListener('change', renderChart);
els.chartY.addEventListener('change', renderChart);
els.privacy.textContent = 'Local-only workspace';
render();
