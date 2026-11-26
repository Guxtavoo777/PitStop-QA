// Páginas renderizadas no servidor: respondem e trazem o essencial de acessibilidade.
const app = require('../../server');
const { request, novoUsuario } = require('../helpers');

let agente;
beforeAll(async () => { agente = await novoUsuario(app, 'paginas_1'); });

describe('Páginas', () => {
  it('IT-24 a página inicial abre para visitantes', async () => {
    const r = await request(app).get('/');
    expect(r.status).toBe(200);
    expect(r.text).toContain('lang="pt-BR"');
  });

  it.each(['/dashboard', '/garagem', '/revisoes', '/cadastro', '/explorar', '/oficinas', '/perfil'])(
    'IT-25 %s abre com sessão, com link para pular ao conteúdo e botões A−/A/A+',
    async rota => {
      const r = await agente.get(rota);
      expect(r.status).toBe(200);
      expect(r.text).toContain('class="skip-link"');
      expect(r.text).toContain('data-fonte="maior"');
    });

  it('IT-27 rota inexistente → 404', async () => {
    expect((await agente.get('/rota-que-nao-existe')).status).toBe(404);
  });

  it('IT-51 verificação de saúde responde sem sessão', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });
});
