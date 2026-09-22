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

    // Champs additionnels de l'item, indentes davantage que le "- ". Delegue
    // a parseBlock plutot qu'a une boucle plate : un item peut ainsi porter
    // un mapping imbrique (ex. extensions.somtech, SS2.4) au meme titre que
    // n'importe quelle cle de mapping ailleurs dans le fichier — sans
    // dupliquer la logique de recursion (defaut trouve en revue de fond,
    // T-20260922-0062 : la version plate ne supportait qu'un seul niveau de
    // champs et levait sur tout mapping imbrique).
    const fieldIndent = itemIndent + 2;
    let j = i + 1;
    if (lines[j] && lines[j].indent === fieldIndent) {
      const [restFields, nextIndex] = parseBlock(lines, j, fieldIndent);
      Object.assign(item, restFields);
      j = nextIndex;
    }

    items.push(item);
    i = j;
  }

  return [items, i];
}

function findKeyColon(text) {
  // Le premier ':' de la ligne separe toujours la cle de la valeur dans cette
  // grammaire : une cle n'est JAMAIS quotee et ne contient JAMAIS de ':'. Tout
  // ':' a l'interieur d'une valeur quotee vient donc necessairement APRES le
  // ':' separateur, jamais avant. Une version anterieure de cette fonction
  // "sautait" les ':' a l'interieur des guillemets, en pretendant proteger
  // contre un cas qui ne peut pas se produire ici — une garantie fictive,
  // retiree en revue (T-20260922-0062) : sa suppression totale ne faisait
  // rougir aucun test, preuve qu'elle ne protegeait rien.
  return text.indexOf(':');
}

module.exports = { parseYamlLite };
