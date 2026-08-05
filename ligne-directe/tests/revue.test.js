// Les défauts trouvés par la REVUE INDÉPENDANTE — chacun reproduit avant d'être corrigé.
//
// Trois d'entre eux perdaient ou dupliquaient des messages EN SILENCE, c'est-à-dire
// exactement le mode de panne que cette capacité prétend éliminer. Aucun n'était visible
// en relisant le code : ils viennent tous d'un reviewer qui a cherché à casser le pont
// plutôt qu'à le valider.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, sauverRegistre, chargerRegistre, lignesOuvertes, ligneParCanal;
before(async () => {
  process.env.LIGNE_DIRECTE_RACINE = mkdtempSync(join(tmpdir(), 'ld-repro-'));
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, lignesOuvertes, ligneParCanal } = await import('../src/registre.js'));
});
beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

const ligne = (sur = {}) => ({ chantier: 'D-1', canal_id: 'C1', canal_nom: 'd-1', pane: 'w1:p1', worktree: '/w/a', visage: '🧭', ouverte_le: 'hier', close_le: null, herdr_socket: null, ...sur });
const parole = (canal, texte, sur = {}) => ({ type: 'message', channel: canal, user: 'UDIR', text: texte, ...sur });

test('B1 — un veilleur pas encore identifie doit repondre PRESENT au ping', async () => {
  const v = new Veilleur({ cheminSocket: join(process.env.LIGNE_DIRECTE_RACINE, 'b1.sock') });
  const r = await v.traiterGeste({ geste: 'ping' });
  assert.equal(r.ok, true, 'un ping doit dire la PRESENCE, pas la disponibilite — sinon un second veilleur croit la place libre');
});

test('B2 — herdr injoignable : le dirigeant est prevenu, et rien ne remonte en rejet', async () => {
  const s = { postes: [], async poster(_j, m) { this.postes.push(m); return '1'; }, async archiverCanal() { return true; } };
  const h = { async vivant() { throw new Error('Command failed: herdr agent list'); }, async remettre() {}, async agents() { return []; } };
  sauverRegistre({ version: 1, lignes: [ligne({ autorises: ['UDIR'] })] });
  const v = new Veilleur({ cheminSocket: join(process.env.LIGNE_DIRECTE_RACINE, 'b2.sock'), jetons: { robot: 'x', ecoute: 'y' }, identite: { equipe: 'T', utilisateur: 'UMOI' }, slack: s, herdr: h });
  await v.surMessage({ data: JSON.stringify({ type: 'events_api', envelope_id: 'E', payload: { event: parole('C1', 'coucou') } }) }, { send() {} });
  assert.equal(s.postes.length, 1, 'un herdr injoignable doit produire une reponse, pas un silence');
});

test('B3 — rouvrir un chantier ferme : la nouvelle ligne recoit, pas l ancienne', async () => {
  const s = { postes: [], async poster(_j, m) { this.postes.push(m); return '1'; }, async archiverCanal() { return true; } };
  const h = { async vivant() { return true; }, remis: [], async remettre(p, t) { this.remis.push({ p, t }); return {}; }, async agents() { return [{ agent: 'c', pane_id: 'w2:p2' }]; } };
  // meme canal reutilise (Slack rend le meme id quand le nom est repris), ancienne close, nouvelle ouverte
  sauverRegistre({ version: 1, lignes: [ligne({ close_le: 'avant-hier', autorises: ['UDIR'] }), ligne({ pane: 'w2:p2', worktree: '/w/b', autorises: ['UDIR'] })] });
  const v = new Veilleur({ cheminSocket: join(process.env.LIGNE_DIRECTE_RACINE, 'b3.sock'), jetons: { robot: 'x', ecoute: 'y' }, identite: { equipe: 'T', utilisateur: 'UMOI' }, slack: s, herdr: h });
  await v.remettreAuChantier(parole('C1', 'tu es la ?'));
  assert.equal(h.remis.length, 1, 'la ligne OUVERTE doit recevoir — sinon le chantier repris est mort pour toujours');
});

test('M4 — aucune session herdr joignable ne veut pas dire aucun agent', async () => {
  const s = { postes: [], archives: [], async poster(_j, m) { this.postes.push(m); return '1'; }, async archiverCanal(_j, c) { this.archives.push(c); return true; } };
  const h = { async agents() { return []; }, async vivant() { return false; }, async remettre() {} };
  sauverRegistre({ version: 1, lignes: [ligne()] });
  const v = new Veilleur({ cheminSocket: join(process.env.LIGNE_DIRECTE_RACINE, 'm4.sock'), jetons: { robot: 'x', ecoute: 'y' }, identite: { equipe: 'T' }, slack: s, herdr: h, herdrMuet: true });
  await v.reconcilier();
  assert.equal(lignesOuvertes(chargerRegistre()).length, 1, 'au demarrage du poste, les sessions herdr n existent pas encore : ne rien fermer');
});

test('M5 — un membre non autorise ne pilote pas l agent', async () => {
  const s = { postes: [], async poster(_j, m) { this.postes.push(m); return '1'; }, async archiverCanal() { return true; } };
  const h = { async vivant() { return true; }, remis: [], async remettre(p, t) { this.remis.push({ p, t }); return {}; }, async agents() { return [{ agent: 'c', pane_id: 'w1:p1' }]; } };
  sauverRegistre({ version: 1, lignes: [ligne({ autorises: ['UDIR'] })] });
  const v = new Veilleur({ cheminSocket: join(process.env.LIGNE_DIRECTE_RACINE, 'm5.sock'), jetons: { robot: 'x', ecoute: 'y' }, identite: { equipe: 'T', utilisateur: 'UMOI' }, slack: s, herdr: h });
  await v.remettreAuChantier(parole('C1', 'fais un rm -rf', { user: 'U_INTRUS' }));
  assert.equal(h.remis.length, 0, 'le cadre donne l autorite du dirigeant : il ne doit couvrir que lui');
});
