// Garagem: CRUD de veículos, validação de entrada e upload de foto.
const app = require('../../server');
const { db } = require('../../db');
const { novoUsuario, novoVeiculo } = require('../helpers');

let agente, vid;
beforeAll(async () => { agente = await novoUsuario(app, 'garagem_1'); });

describe('CRUD de veículos (RF-04, RF-05)', () => {
  it('IT-13 usuário novo tem a garagem vazia', async () => {
    expect((await agente.get('/api/veiculos')).body).toEqual([]);
  });

  it('IT-14 cadastra veículo e devolve o id', async () => {
    const r = await agente.post('/api/veiculos').send({ marca: 'Toyota', modelo: 'Corolla', ano: '2022', km: '35000', placa: 'TCU1A23' });
    expect(r.body.ok).toBe(true);
    vid = r.body.id;
    expect(vid).toBeGreaterThan(0);
  });

  it('IT-15 a listagem traz o veículo criado e ativo', async () => {
    const lista = (await agente.get('/api/veiculos')).body;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: vid, marca: 'Toyota', modelo: 'Corolla', ativo: 1 });
  });

  it('IT-16 edita quilometragem e cor, e a alteração fica gravada', async () => {
    expect((await agente.put(`/api/veiculos/${vid}`).send({ km: '36000', cor: 'Prata' })).body.ok).toBe(true);
    expect(db.prepare('SELECT km, cor FROM veiculos WHERE id = ?').get(vid)).toEqual({ km: '36000', cor: 'Prata' });
  });

  it('IT-17 editar veículo inexistente → ok:false', async () => {
    expect((await agente.put('/api/veiculos/999999').send({ km: '1' })).body.ok).toBe(false);
  });

  it('IT-18 e IT-19 alterna ativo → inativo → ativo', async () => {
    expect((await agente.patch(`/api/veiculos/${vid}/status`)).body.ativo).toBe(false);
    expect((await agente.patch(`/api/veiculos/${vid}/status`)).body.ativo).toBe(true);
  });

  it('IT-20 exclui o veículo e ele some da listagem', async () => {
    expect((await agente.delete(`/api/veiculos/${vid}`)).body.ok).toBe(true);
    expect((await agente.get('/api/veiculos')).body).toEqual([]);
  });

  it('IT-43 excluir veículo inexistente → 404', async () => {
    expect((await agente.delete('/api/veiculos/999999')).status).toBe(404);
  });
});

describe('Exclusão em cascata (RF-05)', () => {
  it('IT-36 excluir o veículo remove também as manutenções e as revisões dele', async () => {
    const id = await novoVeiculo(agente);
    await agente.post(`/api/manut/${id}`).send({ tipo: 'Troca de Óleo', data: '2026-09-01', custo: '250' });
    await agente.post('/api/revisoes').send({ veiculo_id: id, tipo: 'Revisão Simples', data: '2026-09-01' });
    expect(db.prepare('SELECT COUNT(*) c FROM manutencoes WHERE veiculo_id = ?').get(id).c).toBe(1);
    expect(db.prepare('SELECT COUNT(*) c FROM revisoes WHERE veiculo_id = ?').get(id).c).toBe(1);

    await agente.delete(`/api/veiculos/${id}`);
    expect(db.prepare('SELECT COUNT(*) c FROM manutencoes WHERE veiculo_id = ?').get(id).c).toBe(0);
    expect(db.prepare('SELECT COUNT(*) c FROM revisoes WHERE veiculo_id = ?').get(id).c).toBe(0);
  });
});

describe('Validação de entrada', () => {
  it.each([
    ['sem marca', { modelo: 'Argo' }],
    ['sem modelo', { marca: 'Fiat' }],
    ['marca só com espaços', { marca: '   ', modelo: 'Argo' }],
    ['quilometragem negativa', { marca: 'Fiat', modelo: 'Argo', km: '-10' }],
  ])('IT-38 recusa veículo %s com 400 e não grava', async (_, corpo) => {
    const antes = db.prepare('SELECT COUNT(*) c FROM veiculos').get().c;
    expect((await agente.post('/api/veiculos').send(corpo)).status).toBe(400);
    expect(db.prepare('SELECT COUNT(*) c FROM veiculos').get().c).toBe(antes);
  });
});

describe('Upload de foto (RF-06)', () => {
  it('IT-35 arquivo com extensão não permitida é recusado e a foto não muda', async () => {
    const id = await novoVeiculo(agente);
    const r = await agente.post(`/api/veiculos/${id}/foto`).attach('foto', Buffer.from('MZ fake'), 'virus.exe');
    expect(r.status).toBe(400);
    expect(db.prepare('SELECT foto FROM veiculos WHERE id = ?').get(id).foto).toBeNull();
  });
});
