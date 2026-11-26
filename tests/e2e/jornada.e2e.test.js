// E2E: a jornada principal num navegador real, com CSRF ligado e banco em memória.
// O navegador sai de CHROME_PATH ou dos caminhos comuns (no GitHub Actions: /usr/bin/google-chrome).
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'segredo-e2e';
process.env.DB_PATH = ':memory:';
process.env.CSRF_DESATIVADO = '0';

const fs = require('fs');
const puppeteer = require('puppeteer-core');
const app = require('../../server');

const CANDIDATOS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

let server, base, browser, page, vid;
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const texto = () => page.evaluate(() => document.body.innerText);
const clicarENavegar = sel => Promise.all([page.waitForNavigation(), page.click(sel)]);
const definir = (sel, valor) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, valor);

beforeAll(async () => {
  const chrome = CANDIDATOS.find(p => fs.existsSync(p));
  if (!chrome) throw new Error('Navegador não encontrado: defina CHROME_PATH.');
  server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  // movimento reduzido: a landing abre direto, sem a abertura animada (mesma escolha do usuário que pede isso)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.setDefaultTimeout(15000);
});

afterAll(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
});

describe('Jornada principal no navegador', () => {
  it('E2E-01 visitante cria a conta pela página inicial e chega ao painel', async () => {
    await page.goto(base + '/');
    await page.click('.hero__acoes .botao--claro'); // "Criar conta grátis"
    await page.waitForSelector('#cad-nome', { visible: true });
    await page.type('#cad-nome', 'Maria Teste');
    await page.type('#cad-us', 'maria_e2e');
    await page.type('#cad-pw', 'senha123');
    await page.type('#cad-pw2', 'senha123');
    await clicarENavegar('#lp-cadbtn');
    expect(new URL(page.url()).pathname).toBe('/dashboard');
    // garagem ainda vazia: o painel recebe a pessoa pelo nome de usuário
    expect(await texto()).toMatch(/Bem-vindo, maria_e2e/i);
  });

  it('E2E-02 busca o modelo no catálogo e salva o carro na garagem', async () => {
    await page.goto(base + '/cadastro');
    await page.type('#bc', 'Corolla');
    await page.waitForSelector('#cb0', { visible: true });
    await page.click('#cb0');
    await page.type('#fk', '35000');
    await clicarENavegar('button[onclick="salvar(this)"]');
    expect(new URL(page.url()).pathname).toBe('/garagem');
    expect(await texto()).toContain('Corolla');
    vid = await page.$eval('a[href^="/veiculo/"]', a => a.getAttribute('href').split('/').pop());
  });

  it('E2E-03 manutenção com prazo vencido mostra "Revisão atrasada" escrito na ficha', async () => {
    await page.goto(`${base}/manutencao/${vid}`);
    await definir('#dt', dia(-120));
    await definir('#pd', dia(-10));
    await definir('#cu', '420');
    await clicarENavegar('button[onclick="salvar(this)"]');
    expect(new URL(page.url()).pathname).toBe(`/veiculo/${vid}`);
    expect(await texto()).toContain('Revisão atrasada');
  });

  it('E2E-04 revisão nova gera o laudo numerado e tira o carro do atraso', async () => {
    await page.goto(`${base}/revisao/nova?vid=${vid}`);
    await definir('#rv_data', dia(0));
    await definir('#rv_proxdata', dia(180));
    await clicarENavegar('button[onclick="salvarRev(this)"]');
    expect(await texto()).toMatch(/REV-\d{4}-\d{3,}/);
    await page.goto(base + '/garagem');
    expect(await texto()).not.toContain('Revisão atrasada');
  });

  it('E2E-05 teclado: o primeiro Tab leva ao link "Pular para o conteúdo"', async () => {
    await page.goto(base + '/garagem');
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => document.activeElement.className);
    expect(foco).toContain('skip-link');
  });

  it('E2E-06 o botão A+ aumenta o texto e a escolha continua depois de recarregar', async () => {
    await page.goto(base + '/garagem');
    const tamanho = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const antes = await tamanho();
    await page.click('.topnav [data-fonte="maior"]');
    await page.waitForFunction(a => parseFloat(getComputedStyle(document.documentElement).fontSize) > a, {}, antes);
    const depois = await tamanho();
    expect(depois).toBeGreaterThan(antes);
    await page.reload();
    expect(await tamanho()).toBe(depois);
  });

  it('E2E-07 sair encerra a sessão e a garagem volta a pedir login', async () => {
    await page.goto(base + '/logout');
    await page.goto(base + '/garagem');
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
