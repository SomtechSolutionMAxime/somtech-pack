// garde-par-role.test.js — le garde d'ouverture, désormais commun aux deux rôles, ne doit
// JAMAIS présenter la séquence de l'un à l'autre (E-20260813-0002).
//
// CE QUI EST EN JEU, ET CE N'EST PAS UNE SYMÉTRIE D'ÉCRITURE
//
// La ligne d'un représentant est de nature `client` : un canal PRIVÉ, où parlent les gens du
// client, et où `--titre` est obligatoire parce que le client ne doit jamais voir un code de
// chantier. Celle d'un orchestrateur est INTERNE : un canal public, entre nous, nommé par le
// code de son chantier.
//
// Un garde qui laisserait un orchestrateur ouvrir `--nature client` lui ferait créer un canal
// de client pour y déverser de l'interne — exactement ce que le cloisonnement interdit, et le
// motif que le dirigeant a nommé en refusant qu'un topo de gestionnaire atterrisse chez son
// client. Dans l'autre sens, un représentant qui ouvrirait sans `--nature` publierait le nom
// de son client dans un canal public.
//
// Le rôle n'est donc JAMAIS reçu de l'appelant : il est lu du LIEU, par l'en-tête réel de son
// métier (`roleDuLieu`). C'est ce que le dernier test de ce fichier vérifie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { decider, segmentsHorsSequence } from '../src/garde.js';
import { roleDuLieu } from '../src/lieu.js';
import { traiterRequete } from '../src/hook.js';

const OUVERTURE_CLIENT =
  'LD="$HOME/.somtech/ligne-directe/bin/ligne-directe.js"\n' +
  '$LD ouvrir client-acme --nature client --titre "Acme"';
const OUVERTURE_INTERNE =
  'LD="$HOME/.somtech/ligne-directe/bin/ligne-directe.js"\n' +
  '$LD ouvrir D-20260813-0002 --sujet "le lieu de l\'orchestrateur" --inviter maxime.leboeuf@somtech.ca';

const bash = (command) => ({ toolName: 'Bash', toolInput: { command }, ligneOuverte: false });

// ═══════════════════════════════ chaque rôle ouvre SA ligne

test('l’orchestrateur peut ouvrir sa ligne interne', () => {
  assert.deepEqual(segmentsHorsSequence(OUVERTURE_INTERNE, 'orchestrateur'), []);
  assert.equal(decider({ ...bash(OUVERTURE_INTERNE), role: 'orchestrateur' }).permissionDecision, 'allow');
});

test('le représentant peut ouvrir sa ligne client', () => {
  assert.deepEqual(segmentsHorsSequence(OUVERTURE_CLIENT, 'representant'), []);
  assert.equal(decider({ ...bash(OUVERTURE_CLIENT), role: 'representant' }).permissionDecision, 'allow');
});

// ═══════════════════════════════ et JAMAIS celle de l'autre

test('un orchestrateur NE PEUT PAS ouvrir un canal de client — ce serait de l’interne chez le client', () => {
  const d = decider({ ...bash(OUVERTURE_CLIENT), role: 'orchestrateur' });
  assert.equal(d.permissionDecision, 'deny');
});

test('un représentant NE PEUT PAS ouvrir une ligne interne — le nom de son client partirait en public', () => {
  const d = decider({ ...bash(OUVERTURE_INTERNE), role: 'representant' });
  assert.equal(d.permissionDecision, 'deny');
});

test('la nature est refusée À TOUTE POSITION pour un orchestrateur', () => {
  // DÉFAUT TROUVÉ EN REVUE DE FOND (passe 2), et ce test est né de lui : la garde écrivait
  // l'interdiction en position, donc APRÈS le premier mot. `ouvrir --nature client D-1`
  // passait — la commande exacte que la garde existe pour refuser.
  //
  // La version précédente de ce test n'éprouvait QUE les placements tardifs : elle était
  // verte sur une garde trouée. « Une porte sur deux », dans un test cette fois.
  for (const commande of [
    '$LD ouvrir --nature client D-1 --titre "X"',
    '$LD ouvrir  --nature client D-1',
    'node /x/ligne-directe.js ouvrir --nature client D-1 --titre "X"',
    '$LD ouvrir D-1 --nature client --titre "X"',
    '$LD ouvrir D-1 --sujet "x" --nature client --titre "X"',
    'node /x/ligne-directe.js ouvrir D-1 --sujet "x" --nature client --titre "X"',
    '$LD ouvrir D-1 --sujet "x" --titre "X" --nature client',
  ]) {
    assert.equal(
      decider({ ...bash(commande), role: 'orchestrateur' }).permissionDecision, 'deny',
      `« ${commande} » a été laissée passer pour un orchestrateur`,
    );
  }
});

test('un rôle inconnu n’ouvre RIEN — le repli est le refus, jamais la permission', () => {
  // Un garde qui, faute de reconnaître le rôle, laisserait passer serait pire qu'absent : il
  // donnerait l'illusion d'une garde. Le repli sûr est celui qui bloque.
  for (const commande of [OUVERTURE_CLIENT, OUVERTURE_INTERNE]) {
    assert.equal(decider({ ...bash(commande), role: 'inconnu' }).permissionDecision, 'deny');
  }
});

test('une commande composée qui COMMENCE par l’ouverture ne passe pas', () => {
  // Chaque segment doit être autorisé : sans ça, `ouvrir … && rm -rf /` passerait sur la foi
  // de son premier segment.
  const compose = `${OUVERTURE_INTERNE} && git push --force`;
  assert.equal(decider({ ...bash(compose), role: 'orchestrateur' }).permissionDecision, 'deny');
});

// ═══════════════════════════════ le rôle vient du LIEU, jamais de l'appelant

/** Un lieu sur disque, tel que la pose l'aurait laissé — les quatre fichiers, les en-têtes réels. */
function lieuJetable(entetes) {
  const racine = mkdtempSync(join(tmpdir(), 'garde-role-'));
  mkdirSync(join(racine, '.claude'), { recursive: true });
  writeFileSync(join(racine, 'CLAUDE.md'), `${entetes.claude}\n`);
  writeFileSync(join(racine, 'CONTEXTE.md'), `${entetes.contexte}\n`);
  writeFileSync(join(racine, '.mcp.json'), '{"mcpServers":{}}\n');
  writeFileSync(join(racine, '.claude', 'settings.json'), '{"permissions":{"allow":[]}}\n');
  return racine;
}

const LIEU_ORCH = {
  claude: "# Tu es l'orchestrateur de ce chantier",
  contexte: '# Ce qui est propre à ce dépôt',
};
const LIEU_REPR = {
  claude: '# Tu es le représentant de ce client',
  contexte: "# Ce qu'on sait de ce client",
};

test('le rôle se lit dans l’EN-TÊTE du métier, pas dans le nom du dossier', () => {
  assert.equal(roleDuLieu(lieuJetable(LIEU_ORCH)), 'orchestrateur');
  assert.equal(roleDuLieu(lieuJetable(LIEU_REPR)), 'representant');
  // Un dossier qui porte les quatre fichiers mais dont le métier est autre chose n'est le
  // lieu de personne : le garde n'a pas à s'y appliquer, et il n'a pas à deviner lequel.
  assert.equal(roleDuLieu(lieuJetable({ claude: '# Un projet quelconque', contexte: '# Notes' })), null);
});

test('le hook prend le rôle du lieu où la session tourne — pas ce qu’on lui passerait', async () => {
  // La requête ne porte AUCUN rôle : c'est `cwd` qui décide. Un appelant ne peut donc pas se
  // présenter comme un rôle qu'il n'est pas.
  const lieu = lieuJetable(LIEU_ORCH);
  const jamaisOuverte = async () => ({ pane: 'w1:p1', etat: { ouvertes: [] } });

  const client = await traiterRequete(
    { cwd: lieu, tool_name: 'Bash', tool_input: { command: OUVERTURE_CLIENT } }, jamaisOuverte
  );
  assert.equal(client.permissionDecision, 'deny', 'le lieu est celui d’un orchestrateur : la séquence client doit être refusée');

  const interne = await traiterRequete(
    { cwd: lieu, tool_name: 'Bash', tool_input: { command: OUVERTURE_INTERNE } }, jamaisOuverte
  );
  assert.equal(interne.permissionDecision, 'allow');
});

test('hors du lieu d’un agent, le garde ne s’applique pas — il ne gêne aucune session ordinaire', async () => {
  const ordinaire = mkdtempSync(join(tmpdir(), 'ordinaire-'));
  const d = await traiterRequete(
    { cwd: ordinaire, tool_name: 'Bash', tool_input: { command: 'git status' } },
    async () => ({ pane: 'w1:p1', etat: { ouvertes: [] } })
  );
  assert.equal(d.permissionDecision, 'allow');
});

test('un environnement cassé ne fait jamais ÉLARGIR l’accès', async () => {
  // Si herdr ou la ligne directe sont injoignables, on ne sait pas si la ligne est ouverte :
  // le repli est « non ouverte », donc bloquer plus tôt — jamais laisser passer.
  const lieu = lieuJetable(LIEU_ORCH);
  const d = await traiterRequete(
    { cwd: lieu, tool_name: 'Bash', tool_input: { command: 'git status' } },
    async () => {
      throw new Error('herdr injoignable');
    }
  );
  assert.equal(d.permissionDecision, 'deny');
});
