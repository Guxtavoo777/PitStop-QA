// Manutenções, revisões e a situação do veículo, pelo caminho real: API → rota → banco → regra.
const app = require('../../server');
const { db, situacao, gastos } = require('../../db');
const { novoUsuario, novoVeiculo, diasAPartirDeHoje } = require('../helpers');

let agente, vid;
beforeAll(async () => {
  agente = await novoUsuario(app, 'manut_1');
  vid = await novoVeiculo(agente);
});

describe('Manutenções (RF-07, RF-08)', () => {
  let mid;
  it('IT-21 registra manutenção no veículo do usuário', async () => {
    const r = await agente.post(`/api/manut/${vid}`).send({ tipo: 'Troca de Óleo', data: '2026-09-01', custo: '250.50', oficina: 'Oficina Centro' });
    expect(r.body.ok).toBe(true);
    mid = r.body.id;
    expect(db.prepare('SELECT custo FROM manutencoes WHERE id = ?').get(mid).custo).toBe(250.5);
  });

  it('IT-22 registrar em veículo inexistente → ok:false', async () => {
    expect((await agente.post('/api/manut/999999').send({ tipo: 'X', data: '2026-09-01' })).body.ok).toBe(false);
  });

  it('IT-23 exclui a própria manutenção', async () => {
    expect((await agente.delete(`/api/manut/${mid}`)).body.ok).toBe(true);
    expect(db.prepare('SELECT 1 FROM manutencoes WHERE id = ?').get(mid)).toBeUndefined();
  });

  it.each([
    ['sem data', { tipo: 'Óleo' }],
    ['com data em outro formato', { tipo: 'Óleo', data: '01/09/2026' }],
    ['sem tipo', { data: '2026-09-01' }],
    ['com valor negativo', { tipo: 'Óleo', data: '2026-09-01', custo: '-5' }],
    ['com próxima data inválida', { tipo: 'Óleo', data: '2026-09-01', proxima_data: '2026-02-30' }],
  ])('IT-39 recusa manutenção %s com 400', async (_, corpo) => {
    expect((await agente.post(`/api/manut/${vid}`).send(corpo)).status).toBe(400);
  });
});

describe('Gastos', () => {
  it('IT-44 o total do veículo soma as manutenções sem erro de centavos', async () => {
    const id = await novoVeiculo(agente);
    for (const custo of ['0.10', '0.20', '100']) await agente.post(`/api/manut/${id}`).send({ tipo: 'Peça', data: '2026-09-01', custo });
    expect(gastos(id)).toBe(100.3);
  });
});

describe('Situação do veículo (RF-11)', () => {
  it('IT-37 serviço novo com próxima data futura tira o veículo do estado atrasado', async () => {
    const id = await novoVeiculo(agente, { modelo: 'Tracker' });
    await agente.post(`/api/manut/${id}`).send({ tipo: 'Troca de Óleo', data: diasAPartirDeHoje(-200), proxima_data: diasAPartirDeHoje(-20) });
    expect(situacao(id).tipo).toBe('critico');
    await agente.post(`/api/manut/${id}`).send({ tipo: 'Troca de Óleo', data: diasAPartirDeHoje(-1), proxima_data: diasAPartirDeHoje(180) });
    expect(situacao(id).tipo).toBe('ok');
  });

  it('IT-45 uma revisão recente também conta para a situação', async () => {
    const id = await novoVeiculo(agente);
    await agente.post(`/api/manut/${id}`).send({ tipo: 'Troca de Óleo', data: diasAPartirDeHoje(-200), proxima_data: diasAPartirDeHoje(-20) });
    await agente.post('/api/revisoes').send({ veiculo_id: id, tipo: 'Revisão Completa', data: diasAPartirDeHoje(0), proxima_data: diasAPartirDeHoje(10) });
    expect(situacao(id)).toEqual({ tipo: 'aviso', texto: 'Revisão próxima' });
  });

  it('IT-46 a garagem mostra o estado escrito, não só por cor', async () => {
    const id = await novoVeiculo(agente, { modelo: 'Atrasado' });
    await agente.post(`/api/manut/${id}`).send({ tipo: 'Óleo', data: diasAPartirDeHoje(-90), proxima_data: diasAPartirDeHoje(-5) });
    expect((await agente.get('/garagem')).text).toContain('Revisão atrasada');
  });
});

describe('Revisões e laudo (RF-09, RF-10)', () => {
  it('IT-33 o número do laudo não se repete depois de excluir outra revisão', async () => {
    const nova = () => agente.post('/api/revisoes').send({ veiculo_id: vid, tipo: 'Revisão Simples', data: '2026-09-01' });
    const a = (await nova()).body, b = (await nova()).body;
    expect(a.numero_doc).toMatch(/^REV-\d{4}-\d{3,}$/);
    await agente.delete(`/api/revisoes/${a.id}`);
    const c = (await nova()).body;
    expect(new Set([a.numero_doc, b.numero_doc, c.numero_doc]).size).toBe(3);
    expect(db.prepare('SELECT numero_doc FROM revisoes WHERE id = ?').get(c.id).numero_doc).toBe(c.numero_doc);
  });

  it('IT-47 revisão sem data → 400', async () => {
    expect((await agente.post('/api/revisoes').send({ veiculo_id: vid, tipo: 'Revisão Simples' })).status).toBe(400);
  });

  it('IT-48 o laudo abre para o dono com o número do documento', async () => {
    const r = (await agente.post('/api/revisoes').send({ veiculo_id: vid, tipo: 'Revisão Completa', data: '2026-09-02' })).body;
    const pagina = await agente.get(`/revisao/${r.id}/documento`);
    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain(r.numero_doc);
  });
});
