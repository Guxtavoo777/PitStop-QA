// Autenticação e acesso: HTTP real (Supertest) + sessão + banco SQLite em memória.
const app = require('../../server');
const { db } = require('../../db');
const { request, SENHA, novoUsuario } = require('../helpers');

describe('Cadastro e login (RF-01, RF-02, RF-03)', () => {
  it('IT-01 login com senha errada → 401', async () => {
    const r = await request(app).post('/api/login').send({ usuario: 'aluno', senha: 'errada' });
    expect(r.status).toBe(401);
    expect(r.body.ok).toBe(false);
  });

  it('IT-02 login sem senha → 400', async () => {
    const r = await request(app).post('/api/login').send({ usuario: 'aluno' });
    expect(r.status).toBe(400);
  });

  it('IT-03 cadastro de usuário novo → 201, sessão aberta e senha guardada com hash', async () => {
    const agente = request.agent(app);
    const r = await agente.post('/api/cadastro').send({ usuario: 'maria_1', senha: SENHA, senha2: SENHA });
    expect(r.status).toBe(201);
    expect((await agente.get('/api/veiculos')).status).toBe(200);
    const salvo = db.prepare('SELECT senha FROM usuarios WHERE usuario = ?').get('maria_1');
    expect(salvo.senha).not.toBe(SENHA);
    expect(salvo.senha.startsWith('$2')).toBe(true);
  });

  it('IT-04 cadastro de usuário já existente → 409', async () => {
    await novoUsuario(app, 'repetido');
    const r = await request(app).post('/api/cadastro').send({ usuario: 'repetido', senha: SENHA, senha2: SENHA });
    expect(r.status).toBe(409);
  });

  it('IT-05 senhas diferentes → 400', async () => {
    const r = await request(app).post('/api/cadastro').send({ usuario: 'joao_1', senha: SENHA, senha2: 'outra123' });
    expect(r.status).toBe(400);
  });

  it('IT-06 senha com menos de 6 caracteres → 400', async () => {
    const r = await request(app).post('/api/cadastro').send({ usuario: 'joao_2', senha: '123', senha2: '123' });
    expect(r.status).toBe(400);
  });

  it('IT-07 login com a conta de demonstração → 200 e ok', async () => {
    const r = await request(app).post('/api/login').send({ usuario: 'aluno', senha: 'senha123' });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('IT-08 logout encerra a sessão', async () => {
    const agente = await novoUsuario(app, 'sai_logo');
    const r = await agente.get('/logout');
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('/');
    expect((await agente.get('/api/veiculos')).status).toBe(401);
  });
});

describe('Rotas protegidas sem sessão (RNF-04)', () => {
  it('IT-09 GET /garagem redireciona para a entrada', async () => {
    const r = await request(app).get('/garagem');
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('/');
  });
  it('IT-10 GET /api/veiculos → 401', async () => {
    expect((await request(app).get('/api/veiculos')).status).toBe(401);
  });
  it('IT-11 POST /api/veiculos → 401 e nada é gravado', async () => {
    const antes = db.prepare('SELECT COUNT(*) c FROM veiculos').get().c;
    expect((await request(app).post('/api/veiculos').send({ marca: 'X', modelo: 'Y' })).status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) c FROM veiculos').get().c).toBe(antes);
  });
  it('IT-12 GET /perfil redireciona para a entrada', async () => {
    expect((await request(app).get('/perfil')).status).toBe(302);
  });
});

describe('Troca de senha (RF-13)', () => {
  it('IT-34 senha atual errada é recusada e a senha não muda', async () => {
    const agente = await novoUsuario(app, 'troca_senha');
    const r = await agente.put('/api/perfil/senha').send({ senha_atual: 'errada', senha_nova: 'nova12345' });
    expect(r.body.ok).toBe(false);
    const login = await request(app).post('/api/login').send({ usuario: 'troca_senha', senha: SENHA });
    expect(login.body.ok).toBe(true);
  });

  it('IT-41 senha atual certa troca a senha', async () => {
    const agente = await novoUsuario(app, 'troca_ok');
    expect((await agente.put('/api/perfil/senha').send({ senha_atual: SENHA, senha_nova: 'nova12345' })).body.ok).toBe(true);
    expect((await request(app).post('/api/login').send({ usuario: 'troca_ok', senha: 'nova12345' })).body.ok).toBe(true);
    expect((await request(app).post('/api/login').send({ usuario: 'troca_ok', senha: SENHA })).status).toBe(401);
  });
});
