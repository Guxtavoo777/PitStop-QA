// RF-14: um usuário nunca alcança os dados de outro. Dois usuários reais, mesma aplicação.
const app = require('../../server');
const { db } = require('../../db');
const { novoUsuario, novoVeiculo } = require('../helpers');

let dono, outro, vid, manutId, revId;
beforeAll(async () => {
  dono = await novoUsuario(app, 'it_dono');
  outro = await novoUsuario(app, 'it_outro');
  vid = await novoVeiculo(dono);
  manutId = (await dono.post(`/api/manut/${vid}`).send({ tipo: 'Troca de Óleo', data: '2026-09-01', custo: '250' })).body.id;
  revId = (await dono.post('/api/revisoes').send({ veiculo_id: vid, tipo: 'Revisão Simples', data: '2026-09-01' })).body.id;
});

const existe = (tabela, id) => db.prepare(`SELECT 1 FROM ${tabela} WHERE id = ?`).get(id) !== undefined;

describe('Isolamento de dados entre usuários (RF-14)', () => {
  it('IT-28 outro usuário não consegue excluir a manutenção do dono', async () => {
    expect(existe('manutencoes', manutId)).toBe(true);
    expect((await outro.delete(`/api/manut/${manutId}`)).status).toBe(404);
    expect(existe('manutencoes', manutId)).toBe(true);
  });

  it('IT-29 outro usuário não consegue excluir a revisão do dono', async () => {
    expect(existe('revisoes', revId)).toBe(true);
    expect((await outro.delete(`/api/revisoes/${revId}`)).status).toBe(404);
    expect(existe('revisoes', revId)).toBe(true);
  });

  it('IT-30 outro usuário não enxerga os veículos do dono', async () => {
    expect((await outro.get('/api/veiculos')).body).toEqual([]);
  });

  it('IT-40 excluir o veículo do dono pelo id não apaga nada dele', async () => {
    expect((await outro.delete(`/api/veiculos/${vid}`)).status).toBe(404);
    expect(existe('veiculos', vid)).toBe(true);
    expect(existe('manutencoes', manutId)).toBe(true);
    expect(existe('revisoes', revId)).toBe(true);
  });

  it('IT-49 outro usuário não registra manutenção nem edita o veículo do dono', async () => {
    expect((await outro.post(`/api/manut/${vid}`).send({ tipo: 'X', data: '2026-09-01' })).body.ok).toBe(false);
    expect((await outro.put(`/api/veiculos/${vid}`).send({ km: '1' })).body.ok).toBe(false);
    expect(db.prepare('SELECT km FROM veiculos WHERE id = ?').get(vid).km).toBe('1000');
  });

  it('IT-50 outro usuário não abre a ficha nem o laudo do dono', async () => {
    expect((await outro.get(`/veiculo/${vid}`)).status).toBe(302);
    expect((await outro.get(`/revisao/${revId}/documento`)).status).toBe(302);
  });
});
