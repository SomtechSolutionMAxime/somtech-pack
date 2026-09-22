'use strict';

// Parseur YAML minimal, volontairement restreint au sous-ensemble dont ops-discovery
// a besoin : scalaires top-level, un niveau d'imbrication (ex. auth.mode), et des
// listes d'objets plats (ex. agents statiques, mecanisme #1 de STD-032 SS2.10).
// Zero dependance npm : le service demarre sans "npm install" (I6 STD-032 —
// sans dependance Somtech ; propriete utile aussi sur un hote sans acces reseau
// pour installer des paquets).
//
// Ce n'est PAS un parseur YAML general. Une syntaxe hors de ce sous-ensemble
// (ancres, multi-documents, blocs litteraux |, flow mapping {a: b}) leve une erreur
// plutot que de produire un resultat silencieusement faux.

function coerceScalar(raw) {
  const value = raw.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (value === '[]') return [];
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function indentOf(line) {
  const match = line.match(/^ */);
  return match[0].length;
}

function parseYamlLite(text) {
  const rawLines = text.split('\n');
  const lines = [];
  for (const line of rawLines) {
    const withoutComment = stripComment(line);
    if (withoutComment.trim() === '') continue;
    lines.push({ indent: indentOf(withoutComment), text: withoutComment.trim() });
  }

  const [result] = parseBlock(lines, 0, 0);
  return result;
}

function stripComment(line) {
  // Un '#' n'est un commentaire que hors chaine quotee — cas simple suffisant
  // pour ce sous-ensemble (pas de '#' dans les valeurs de ops-discovery).
  const hashIndex = line.indexOf('#');
  if (hashIndex === -1) return line;
  const before = line.slice(0, hashIndex);
  const quoteCount = (before.match(/["']/g) || []).length;
  if (quoteCount % 2 !== 0) return line; // '#' a l'interieur d'une chaine quotee
  return before;
}

// Parse un bloc de mappings a partir de `start`, tant que l'indentation
// >= `minIndent`. Retourne [objet, prochainIndex].
function parseBlock(lines, start, minIndent) {
  const result = {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < minIndent) break;
    if (line.indent > minIndent) {
      throw new Error(`indentation inattendue a la ligne "${line.text}"`);
    }
    if (line.text.startsWith('- ') || line.text === '-') {
      throw new Error('liste rencontree hors du contexte "cle:", parseBlock ne gere pas les listes en racine');
    }

    const colonIndex = findKeyColon(line.text);
    if (colonIndex === -1) {
      throw new Error(`ligne sans "cle: valeur" : "${line.text}"`);
    }
    const key = line.text.slice(0, colonIndex).trim();
    const rest = line.text.slice(colonIndex + 1).trim();

    if (rest !== '') {
      result[key] = coerceScalar(rest);
      i += 1;
      continue;
    }

    // Valeur vide sur cette ligne : soit un mapping imbrique, soit une liste,
    // portes par les lignes suivantes a une indentation plus grande.
    const next = lines[i + 1];
    if (!next || next.indent <= line.indent) {
      // Cle sans valeur ni enfant (ex. "agents:" tout seul, deja couvert par
      // le raccourci "agents: []" dans coerceScalar — ici on tombe seulement
      // si le fichier ne suit pas cette convention).
      result[key] = null;
      i += 1;
      continue;
    }

    if (next.text.startsWith('- ')) {
      const [list, nextIndex] = parseList(lines, i + 1, next.indent);
      result[key] = list;
      i = nextIndex;
    } else {
      const [child, nextIndex] = parseBlock(lines, i + 1, next.indent);
      result[key] = child;
      i = nextIndex;
    }
  }

  return [result, i];
}

function parseList(lines, start, itemIndent) {
  const items = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.indent !== itemIndent || !line.text.startsWith('- ')) break;

    const firstFieldText = line.text.slice(2);
    const colonIndex = findKeyColon(firstFieldText);
    if (colonIndex === -1) {
      throw new Error(`item de liste non supporte (attendu "- cle: valeur") : "${line.text}"`);
    }

    const item = {};
    item[firstFieldText.slice(0, colonIndex).trim()] = coerceScalar(
      firstFieldText.slice(colonIndex + 1)
    );

    // Champs additionnels de l'item, indentes davantage que le "- ".
    const fieldIndent = itemIndent + 2;
    let j = i + 1;
    while (j < lines.length && lines[j].indent === fieldIndent) {
      const fieldColon = findKeyColon(lines[j].text);
      if (fieldColon === -1) {
        throw new Error(`champ d'item non supporte : "${lines[j].text}"`);
      }
      item[lines[j].text.slice(0, fieldColon).trim()] = coerceScalar(
        lines[j].text.slice(fieldColon + 1)
      );
      j += 1;
    }

    items.push(item);
    i = j;
  }

  return [items, i];
}

function findKeyColon(text) {
  // Le premier ':' qui n'est pas a l'interieur d'une chaine quotee.
  let inQuote = null;
  for (let idx = 0; idx < text.length; idx += 1) {
    const ch = text[idx];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === ':') return idx;
  }
  return -1;
}

module.exports = { parseYamlLite };
