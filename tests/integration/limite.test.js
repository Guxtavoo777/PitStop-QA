// Limite de tentativas de login, num arquivo próprio: o contador é por instância da aplicação.
const app = require('../../server');
const { request } = require('../helpers');

describe('Limite de tentativas de login (RNF-03)', () => {
  it('IT-32 as 20 primeiras tentativas passam; a 21ª em 15 minutos é recusada com 429', async () => {
    for (let i = 1; i <= 20; i++) {
      expect((await request(app).post('/api/login').send({ usuario: 'aluno', senha: 'errada' })).status).toBe(401);
    }
    expect((await request(app).post('/api/login').send({ usuario: 'aluno', senha: 'errada' })).status).toBe(429);
  });
});
