const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /reveal\s+(the\s+)?(system|developer)\s+prompt/i,
  /override\s+(the\s+)?(system|policy|rules)/i,
  /act\s+as\s+(the\s+)?system/i,
];

const FIELD_ALIASES = {
  upvote: 'upvotes', votes: 'upvotes', points: 'upvotes',
  comment: 'comments', replies: 'comments',
  type: 'category', projectcategory: 'category',
  launch: 'launchDate', launched: 'launchDate', date: 'launchDate',
  site: 'url', website: 'url', link: 'url',
  status: 'outcome'
};

export function slugify(value = '') {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function stableHash(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function detectInjection(text = '') {
  const matched = INJECTION_PATTERNS.filter((pattern) => pattern.test(text));
  return { suspicious: matched.length > 0, count: matched.length };
}

function cleanKey(key = '') {
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return FIELD_ALIASES[compact] || key.trim().replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
}

export function normalizeValue(rawValue = '') {
  const raw = String(rawValue).trim();
  if (!raw) return { type: 'string', raw, value: '' };

  const urlMatch = raw.match(/https?:\/\/[^\s,)]+/i);
  if (urlMatch && urlMatch[0] === raw.replace(/[.)]$/, '')) {
    return { type: 'url', raw, value: urlMatch[0] };
  }

  const currency = raw.match(/^([$€£])\s*([\d,.]+)\s*([kmb])?$/i);
  if (currency) {
    const multiplier = { k: 1e3, m: 1e6, b: 1e9 }[(currency[3] || '').toLowerCase()] || 1;
    return { type: 'number', raw, value: Number(currency[2].replace(/,/g, '')) * multiplier, unit: currency[1] };
  }

  const range = raw.match(/^(-?[\d,.]+)\s*(?:-|–|—|to)\s*(-?[\d,.]+)\s*([a-z%]+)?$/i);
  if (range) {
    return {
      type: 'range', raw,
      value: { min: Number(range[1].replace(/,/g, '')), max: Number(range[2].replace(/,/g, '')) },
      unit: range[3] || undefined
    };
  }

  const numberWithUnit = raw.match(/^(-?[\d,.]+)\s*([a-z%]+)?$/i);
  if (numberWithUnit) {
    return { type: 'number', raw, value: Number(numberWithUnit[1].replace(/,/g, '')), unit: numberWithUnit[2] || undefined };
  }

  const isoDate = raw.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoDate && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    return { type: 'date', raw, value: raw };
  }

  return { type: 'string', raw, value: raw };
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s|,)]+/i);
  return match?.[0] || null;
}

function parseNaturalStats(text) {
  const fields = {};
  const patterns = [
    ['upvotes', /(?:upvotes?|points?|votes?)\s*[:=]?\s*(\d[\d,]*)/i],
    ['comments', /(?:comments?|replies)\s*[:=]?\s*(\d[\d,]*)/i],
    ['launchDate', /(?:launch(?:ed)?|date)\s*[:=]?\s*(\d{4}-\d{2}-\d{2})/i],
  ];
  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) fields[key] = match[1];
  }
  const category = text.match(/(?:category|type)\s*[:=]\s*([^|;,.]+)/i);
  if (category) fields.category = category[1].trim();
  const outcome = text.match(/(?:outcome|status)\s*[:=]\s*([^|;,.]+)/i);
  if (outcome) fields.outcome = outcome[1].trim();
  const url = extractUrl(text);
  if (url) fields.url = url;
  return fields;
}

function parseBlock(block, sourceId, index) {
  const rawLines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  const full = rawLines.join(' ');
  const authorMatch = full.match(/^@?([a-z0-9_-]{2,32})\s*[:>-]\s*/i);
  const author = authorMatch?.[1] || `contributor-${index + 1}`;
  const withoutAuthor = authorMatch ? full.slice(authorMatch[0].length) : full;

  let name = '';
  let remainder = withoutAuthor;
  if (withoutAuthor.includes('|')) {
    const first = withoutAuthor.split('|')[0].trim();
    name = first.replace(/^(project|item|tool)\s*[:=-]\s*/i, '').trim();
    remainder = withoutAuthor.split('|').slice(1).join('|');
  } else {
    const named = withoutAuthor.match(/^(?:project|item|tool)\s*[:=-]\s*([^.;|]+)/i);
    if (named) name = named[1].trim();
    else {
      const dash = withoutAuthor.match(/^([^–—-]{2,80})\s*[–—-]\s*/);
      name = dash?.[1]?.trim() || '';
    }
  }

  const explicit = {};
  for (const segment of remainder.split('|')) {
    const pair = segment.match(/^\s*([^=:]{2,40})\s*[:=]\s*(.+?)\s*$/);
    if (pair) explicit[cleanKey(pair[1])] = pair[2].trim();
  }
  const fields = { ...parseNaturalStats(withoutAuthor), ...explicit };
  if (!name && fields.name) {
    name = fields.name;
    delete fields.name;
  }
  if (!name) return null;

  const evidence = {
    sourceId,
    author,
    excerpt: block.slice(0, 320),
    sourceHash: stableHash(block),
    blockIndex: index
  };
  const normalizedFields = {};
  for (const [key, rawValue] of Object.entries(fields)) {
    normalizedFields[key] = { ...normalizeValue(rawValue), evidence };
  }

  const security = detectInjection(block);
  return {
    proposalId: `${sourceId}-${index}-${slugify(name)}`,
    name,
    normalizedName: slugify(name),
    fields: normalizedFields,
    evidence,
    confidence: Math.min(0.98, 0.55 + Object.keys(normalizedFields).length * 0.06 + (authorMatch ? 0.05 : 0)),
    security
  };
}

export function extractCandidates(threadText, sourceId = `src-${stableHash(threadText)}`) {
  const text = String(threadText || '').trim();
  if (!text) return { sourceId, proposals: [], source: null };
  const blocks = text.split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
  const proposals = blocks.map((block, index) => parseBlock(block, sourceId, index)).filter(Boolean);
  return {
    sourceId,
    proposals,
    source: {
      id: sourceId,
      kind: 'discussion',
      createdAt: new Date().toISOString(),
      hash: stableHash(text),
      bytes: new TextEncoder().encode(text).length,
      blockCount: blocks.length,
      suspiciousBlocks: proposals.filter((proposal) => proposal.security.suspicious).length,
      preview: text.slice(0, 240)
    }
  };
}

function comparableUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return '';
  }
}

export function findDuplicate(candidate, items = []) {
  const candidateUrl = candidate.fields?.url?.value ? comparableUrl(candidate.fields.url.value) : '';
  for (const item of items) {
    if (item.normalizedName === candidate.normalizedName) return { itemId: item.id, reason: 'same normalized name', score: 1 };
    const itemUrl = item.fields?.url?.value ? comparableUrl(item.fields.url.value) : '';
    if (candidateUrl && itemUrl && candidateUrl === itemUrl) return { itemId: item.id, reason: 'same canonical URL', score: 1 };
  }
  return null;
}

export function applyProposal(candidate, items = [], action = 'accept') {
  if (action === 'reject') return { items, event: { type: 'proposal.rejected', proposalId: candidate.proposalId } };
  const duplicate = findDuplicate(candidate, items);
  if (!duplicate) {
    const item = {
      id: `item-${stableHash(candidate.proposalId)}`,
      name: candidate.name,
      normalizedName: candidate.normalizedName,
      fields: candidate.fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: [candidate.evidence]
    };
    return { items: [...items, item], event: { type: 'item.created', itemId: item.id, proposalId: candidate.proposalId } };
  }

  const merged = items.map((item) => {
    if (item.id !== duplicate.itemId) return item;
    return {
      ...item,
      name: candidate.name || item.name,
      fields: { ...item.fields, ...candidate.fields },
      updatedAt: new Date().toISOString(),
      provenance: [...(item.provenance || []), candidate.evidence]
    };
  });
  return { items: merged, event: { type: 'item.merged', itemId: duplicate.itemId, proposalId: candidate.proposalId, reason: duplicate.reason } };
}

export function inferSchema(items = [], proposals = []) {
  const fieldMap = new Map();
  const all = [...items, ...proposals];
  for (const entry of all) {
    for (const [key, field] of Object.entries(entry.fields || {})) {
      if (!fieldMap.has(key)) fieldMap.set(key, { key, types: new Map(), count: 0 });
      const stat = fieldMap.get(key);
      stat.count += 1;
      stat.types.set(field.type, (stat.types.get(field.type) || 0) + 1);
    }
  }
  return [...fieldMap.values()].map((stat) => ({
    key: stat.key,
    type: [...stat.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'string',
    count: stat.count
  }));
}

export function recommendChart(schema = [], items = []) {
  const numeric = schema.filter((field) => field.type === 'number');
  const categories = schema.filter((field) => field.type === 'string' && new Set(items.map((item) => item.fields?.[field.key]?.value).filter(Boolean)).size <= 12);
  if (numeric.length >= 2) {
    return { type: 'scatter', x: numeric[0].key, y: numeric[1].key, reason: 'two numeric fields support relationship comparison' };
  }
  if (numeric.length >= 1) {
    return { type: 'bar', x: 'name', y: numeric[0].key, color: categories[0]?.key || null, reason: 'one numeric measure is best compared across items' };
  }
  if (categories.length >= 1) {
    return { type: 'group', x: categories[0].key, y: 'count', reason: 'categorical data is best summarized by counts' };
  }
  return { type: 'table', reason: 'not enough typed dimensions for a meaningful chart' };
}

export function fieldValue(item, key) {
  if (key === 'name') return item.name;
  return item.fields?.[key]?.value ?? '';
}

export function sortItems(items, key, direction = 'desc') {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = fieldValue(a, key);
    const bv = fieldValue(b, key);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}
