// parser.js — Parser BRD déterministe (zéro LLM), port de Architecture/scripts/extract-brd-yaml.py.
// Cible : gabarit Somcraft v2.1.0 (STD-033 §2.4). Entrée = contenu MD brut (tel que rendu par
// Somcraft read_document, marqueurs `<!-- bid:xxx -->` inline tolérés). Sortie = structure JS
// à parité sémantique avec le parser Python (comparaison après re-parse, cf. cli/src/brd/SPEC.md).
//
// Le parser est PUR : aucune I/O, aucun appel MCP. L'appelant fait le hop read_document et pipe
// le contenu ici. Chaque exigence porte `md_block_id` = block_id du tableau Somcraft qui la contient
// (null si les marqueurs bid sont absents, ex. fixtures Python).

const SENTINEL = '\x00BRD_ESCAPED_PIPE\x00';

const ID_REGEX = /^(EA|EF|RA|HS)-[A-Z]{3}-\d{3}$/;
const TICKET_REGEX = /^T-\d{8}-\d{4}$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const LIST_SEP_REGEX = /^[^,]+(, [^,]+)+$/;
const ANY_HEADING_REGEX = /^#{1,6}\s+/;
const TABLE_SEPARATOR_REGEX = /^\|(\s*:?-+:?\s*\|)+\s*$/;
const BID_REGEX = /^<!--\s*bid:([A-Za-z0-9_-]+)\s*-->\s*$/;

const RE_SECTION_EA = /^##\s+4\.\s*Exigences d'affaires/;
const RE_SECTION_DOMAIN_5 = /^###\s+5\.\d+\s+Domaine\s+—.*\(code:\s*([A-Z]{3})\)/;
const RE_SECTION_EF = /^####\s+Exigences fonctionnelles\s*$/;
const RE_SECTION_RA = /^####\s+Règles d'affaires\s*$/;
const RE_SECTION_DOMAIN_6 = /^###\s+6\.\d+\s+Domaine\s+—.*\(code:\s*([A-Z]{3})\)/;
const RE_SECTION_CHANGELOG = /^##\s+7\.\s*Changelog/;

const STATUS = new Set(['draft', 'proposed', 'accepted', 'in_force', 'superseded', 'deprecated']);
const PRIORITY = new Set(['M', 'S', 'C', 'W']);
const MODE = new Set(['auto', 'manuel']);
const LIST_COLUMNS = new Set(['Couvre', 'Encadre', 'Réalisé par', 'Testé par']);

const YAML_KEY = {
  ID: 'id', 'Énoncé': 'enonce', Description: 'description', Justification: 'justification',
  Statut: 'statut', 'Priorité': 'priorite', Couvre: 'couvre', Encadre: 'encadre',
  'Réalisé par': 'realise_par', 'Testé par': 'teste_par', Owner: 'owner',
  'Re-considéré quand': 'reconsidere_quand', 'Demande / Projet': 'demande_projet',
  'Sponsor validant': 'sponsor_validant', Mode: 'mode', 'Résumé du changement': 'resume',
  Version: 'version', Date: 'date',
};

const SCHEMAS = {
  EA: ['ID', 'Énoncé', 'Statut', 'Priorité', 'Owner'],
  EF: ['ID', 'Description', 'Statut', 'Priorité', 'Couvre', 'Réalisé par', 'Testé par', 'Owner'],
  RA: ['ID', 'Énoncé', 'Justification', 'Statut', 'Encadre', 'Testé par', 'Owner'],
  HS: ['ID', 'Énoncé', 'Justification', 'Statut', 'Re-considéré quand'],
  CHANGELOG: ['Version', 'Date', 'Demande / Projet', 'Sponsor validant', 'Mode', 'Résumé du changement'],
};

class BRDParseError extends Error {
  constructor(lineNo, message) {
    super(`ligne ${lineNo} : ${message}`);
    this.name = 'BRDParseError';
    this.lineNo = lineNo;
  }
}

function isTableRow(line) {
  return line.trimStart().startsWith('|');
}

/** Découpe une ligne de tableau en cellules, en préservant les pipes littéraux `\|`. */
function splitRow(line) {
  const safe = line.replaceAll('\\|', SENTINEL);
  let parts = safe.split('|');
  if (parts.length && parts[0].trim() === '') parts = parts.slice(1);
  if (parts.length && parts[parts.length - 1].trim() === '') parts = parts.slice(0, -1);
  return parts.map((c) => c.trim().replaceAll(SENTINEL, '|'));
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Parse une cellule-liste selon la convention stricte STD-033 §2.4 (séparateur `, `). */
function parseListCell(col, value, lineNo) {
  const v = value.trim();
  if (v === '' || v === '—') return [];
  if (v.endsWith(',')) {
    throw new BRDParseError(lineNo, `Trailing comma interdite dans la colonne ${col} : '${value}'.`);
  }
  if (v.includes(',') && !LIST_SEP_REGEX.test(v)) {
    throw new BRDParseError(lineNo, `Séparateur de liste ${col} non conforme : '${value}'. Attendu : \`, \` (virgule + un seul espace) exactement entre éléments.`);
  }
  const items = v.split(',').map((s) => s.trim());
  for (const item of items) {
    if (item === '') throw new BRDParseError(lineNo, `Élément vide dans la liste ${col} : '${value}'.`);
    if (col === 'Réalisé par') {
      if (!TICKET_REGEX.test(item)) {
        throw new BRDParseError(lineNo, `Référence '${item}' invalide dans Réalisé par (regex tickets attendue : ^T-\\d{8}-\\d{4}$).`);
      }
    } else if (col === 'Couvre' || col === 'Encadre') {
      if (!ID_REGEX.test(item)) {
        throw new BRDParseError(lineNo, `Référence '${item}' invalide dans ${col} (regex ID attendue : ^(EA|EF|RA|HS)-[A-Z]{3}-\\d{3}$).`);
      }
    }
    // 'Testé par' : chemins libres, pas de regex de format.
  }
  return items;
}

/** Valide/convertit une cellule selon sa colonne. */
function parseCell(col, value, lineNo) {
  if (col === 'ID') {
    if (!ID_REGEX.test(value)) {
      throw new BRDParseError(lineNo, `ID '${value}' invalide (regex attendue : ^(EA|EF|RA|HS)-[A-Z]{3}-\\d{3}$).`);
    }
    return value;
  }
  if (col === 'Statut') {
    if (!STATUS.has(value)) {
      throw new BRDParseError(lineNo, `Statut '${value}' hors enum. Attendu : ${JSON.stringify([...STATUS].sort())}.`);
    }
    return value;
  }
  if (col === 'Priorité') {
    if (!PRIORITY.has(value)) {
      throw new BRDParseError(lineNo, `Priorité '${value}' hors enum. Attendu : ${JSON.stringify([...PRIORITY].sort())}.`);
    }
    return value;
  }
  if (col === 'Mode') {
    if (value !== '' && !MODE.has(value)) {
      throw new BRDParseError(lineNo, `Mode '${value}' hors enum. Attendu : ${JSON.stringify([...MODE].sort())} ou vide.`);
    }
    return value;
  }
  if (col === 'Version') {
    if (!SEMVER_REGEX.test(value)) {
      throw new BRDParseError(lineNo, `Version '${value}' non SemVer (regex attendue : ^\\d+\\.\\d+\\.\\d+$).`);
    }
    return value;
  }
  if (LIST_COLUMNS.has(col)) return parseListCell(col, value, lineNo);
  return value; // texte libre
}

/** Trouve l'index de l'en-tête de tableau à partir de startIdx. Retourne -1 si un heading est croisé avant. */
function findTableHeaderIdx(lines, startIdx, expectedFirstCol) {
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (ANY_HEADING_REGEX.test(line)) return -1;
    if (isTableRow(line.trim())) {
      const cells = splitRow(line);
      if (cells.length && cells[0] === expectedFirstCol) return i;
    }
  }
  return -1;
}

/** block_id du tableau : dernier marqueur `<!-- bid:xxx -->` juste avant l'en-tête (null sinon). */
function blockIdBefore(lines, headerIdx) {
  for (let i = headerIdx - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t === '') continue;
    const m = BID_REGEX.exec(t);
    if (m) return m[1];
    return null; // première ligne non-vide non-bid → pas d'ancre
  }
  return null;
}

/** Parse un tableau complet à partir de headerIdx. Retourne { rows, endIdx }. */
function parseTable(lines, headerIdx, schemaKey) {
  const expected = SCHEMAS[schemaKey];
  const header = splitRow(lines[headerIdx]);
  if (!arraysEqual(header, expected)) {
    throw new BRDParseError(headerIdx + 1, `En-tête de table ${schemaKey} non conforme. Attendu : ${JSON.stringify(expected)}, trouvé : ${JSON.stringify(header)}.`);
  }
  const sepIdx = headerIdx + 1;
  // Match sur la ligne BRUTE (comme le parser Python) : un séparateur indenté est non conforme.
  if (sepIdx >= lines.length || !TABLE_SEPARATOR_REGEX.test(lines[sepIdx])) {
    throw new BRDParseError(sepIdx + 1, `Ligne séparateur de tableau ${schemaKey} manquante ou non conforme.`);
  }
  const n = expected.length;
  // Le séparateur doit avoir le même nombre de colonnes que l'en-tête (fidélité Python, revue 2026-07-10).
  const sepCells = splitRow(lines[sepIdx]);
  if (sepCells.length !== n) {
    throw new BRDParseError(sepIdx + 1, `Séparateur de table ${schemaKey} : ${sepCells.length} cellules, attendu ${n}.`);
  }
  const rows = [];
  let i = sepIdx + 1;
  for (; i < lines.length; i++) {
    if (!isTableRow(lines[i].trim())) break;
    const cells = splitRow(lines[i]);
    if (cells.length !== n) {
      throw new BRDParseError(i + 1, `Nombre de cellules ${cells.length} ≠ ${n} attendu pour ${schemaKey}.`);
    }
    const row = {};
    for (let c = 0; c < n; c++) {
      row[YAML_KEY[expected[c]]] = parseCell(expected[c], cells[c], i + 1);
    }
    rows.push(row);
  }
  return { rows, endIdx: i - 1 };
}

/** Vérifie la cohérence domaine↔ID (erreur ancrée sur la ligne du heading de domaine, comme le parser Python). */
function checkDomainCoherence(rows, domainLine, domainCode, kind) {
  for (const r of rows) {
    const mid = r.id.split('-')[1];
    if (mid !== domainCode) {
      throw new BRDParseError(domainLine, `${kind} '${r.id}' incohérent avec le domaine déclaré (code: ${domainCode}). Le segment central de l'ID doit être '${domainCode}', trouvé '${mid}'.`);
    }
  }
}

/**
 * Parse un BRD.md (v2.1.0) en structure { requirements: {ea, ef, ra}, out_of_scope, changelog }.
 * Chaque exigence ef/ra/hs porte `domaine` ; chaque row porte `md_block_id` (block_id du tableau, ou null).
 * @param {string} mdText
 * @returns {{requirements: {ea: object[], ef: object[], ra: object[]}, out_of_scope: object[], changelog: object[]}}
 */
export function parseBrd(mdText) {
  // Équivalent Python str.splitlines() : coupe aussi sur VT, FF, FS/GS/RS, NEL, LS, PS
  // (fidélité au parser de référence — une cellule contenant U+2028 doit casser la ligne, revue 2026-07-10).
  const lines = mdText.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  const result = { requirements: { ea: [], ef: [], ra: [] }, out_of_scope: [], changelog: [] };
  const seen = new Set();
  let currentDomain5 = null;
  let currentDomain5Line = 0;

  const tagBlock = (rows, headerIdx) => {
    const bid = blockIdBefore(lines, headerIdx);
    for (const r of rows) r.md_block_id = bid;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;

    if (RE_SECTION_EA.test(line)) {
      if (seen.has('EA')) throw new BRDParseError(i + 1, 'Section §4 (Exigences d\'affaires) en double.');
      seen.add('EA');
      const h = findTableHeaderIdx(lines, i + 1, 'ID');
      if (h === -1) throw new BRDParseError(i + 1, 'Tableau EA introuvable après le heading §4.');
      const { rows, endIdx } = parseTable(lines, h, 'EA');
      tagBlock(rows, h);
      result.requirements.ea.push(...rows);
      i = endIdx + 1; continue;
    }

    if ((m = RE_SECTION_DOMAIN_5.exec(line))) {
      currentDomain5 = m[1];
      currentDomain5Line = i + 1;
      i += 1; continue;
    }

    if (RE_SECTION_EF.test(line)) {
      if (currentDomain5 === null) throw new BRDParseError(i + 1, 'Sous-section EF sans domaine §5.X déclaré.');
      const h = findTableHeaderIdx(lines, i + 1, 'ID');
      if (h === -1) throw new BRDParseError(i + 1, 'Tableau EF introuvable.');
      const { rows, endIdx } = parseTable(lines, h, 'EF');
      checkDomainCoherence(rows, currentDomain5Line, currentDomain5, 'EF');
      for (const r of rows) r.domaine = currentDomain5;
      tagBlock(rows, h);
      result.requirements.ef.push(...rows);
      i = endIdx + 1; continue;
    }

    if (RE_SECTION_RA.test(line)) {
      if (currentDomain5 === null) throw new BRDParseError(i + 1, 'Sous-section RA sans domaine §5.X déclaré.');
      const h = findTableHeaderIdx(lines, i + 1, 'ID');
      if (h === -1) throw new BRDParseError(i + 1, 'Tableau RA introuvable.');
      const { rows, endIdx } = parseTable(lines, h, 'RA');
      checkDomainCoherence(rows, currentDomain5Line, currentDomain5, 'RA');
      for (const r of rows) r.domaine = currentDomain5;
      tagBlock(rows, h);
      result.requirements.ra.push(...rows);
      i = endIdx + 1; continue;
    }

    if ((m = RE_SECTION_DOMAIN_6.exec(line))) {
      const code = m[1];
      const domain6Line = i + 1;
      const h = findTableHeaderIdx(lines, i + 1, 'ID');
      if (h === -1) throw new BRDParseError(i + 1, 'Tableau HS introuvable.');
      const { rows, endIdx } = parseTable(lines, h, 'HS');
      checkDomainCoherence(rows, domain6Line, code, 'HS');
      for (const r of rows) r.domaine = code;
      tagBlock(rows, h);
      result.out_of_scope.push(...rows);
      i = endIdx + 1; continue;
    }

    if (RE_SECTION_CHANGELOG.test(line)) {
      if (seen.has('CHANGELOG')) throw new BRDParseError(i + 1, 'Section §7 (Changelog) en double.');
      seen.add('CHANGELOG');
      const h = findTableHeaderIdx(lines, i + 1, 'Version');
      if (h === -1) throw new BRDParseError(i + 1, 'Tableau Changelog introuvable après le heading §7.');
      const { rows, endIdx } = parseTable(lines, h, 'CHANGELOG');
      tagBlock(rows, h);
      result.changelog.push(...rows);
      i = endIdx + 1; continue;
    }

    i += 1;
  }

  const missing = [];
  if (!seen.has('EA')) missing.push('§4 (Exigences d\'affaires)');
  if (!seen.has('CHANGELOG')) missing.push('§7 (Changelog)');
  if (missing.length) {
    throw new BRDParseError(lines.length, `Section(s) obligatoire(s) manquante(s) : ${missing.join(', ')}. Un BRD doit déclarer au minimum §4 (EA) et §7 (Changelog).`);
  }

  return result;
}

export { BRDParseError };
