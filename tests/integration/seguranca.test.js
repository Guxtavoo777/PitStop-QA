// Proteções transversais com a verificação CSRF LIGADA (as outras suítes a desligam de propósito).
process.env.CSRF_DESATIVADO = '0';
const app = require('../../server');
const { db } = require('../../db');
const { request, SENHA } = require('../helpers');

describe('CSRF (RNF-02)', () => {
  it('IT-31 escrita sem o token CSRF é recusada com 403 e nada é gravado', async () => {
    const agente = request.agent(app);
    await agente.post('/api/cadastro').send({ usuario: 'csrf_user', senha: SENHA, senha2: SENHA });
    const r = await agente.post('/api/veiculos').send({ marca: 'Fiat', modelo: 'Argo' });
    expect(r.status).toBe(403);
    expect(db.prepare('SELECT COUNT(*) c FROM veiculos WHERE usuario = ?').get('csrf_user').c).toBe(0);
  });

  it('IT-42 escrita com o token da página é aceita', async () => {
    const agente = request.agent(app);
    await agente.post('/api/cadastro').send({ usuario: 'csrf_ok', senha: SENHA, senha2: SENHA });
    const html = (await agente.get('/garagem')).text;
    const token = /name="csrf-token" content="([a-f0-9]+)"/.exec(html)[1];
    const r = await agente.post('/api/veiculos').set('x-csrf-token', token).send({ marca: 'Fiat', modelo: 'Argo' });
    expect(r.body.ok).toBe(true);
  });
});
