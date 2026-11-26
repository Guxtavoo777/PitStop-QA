# Pit Stop — testes e pipeline CI/CD

Plataforma web de gestão de manutenção de carros (garagem, manutenções, revisões com laudo, avisos de revisão e gastos), com **101 testes automatizados** (unitários, de integração e E2E), Dockerfile com testes obrigatórios e pipeline GitHub Actions que testa, constrói a imagem e publica no Render.

Repositório da disciplina **Teste e Qualidade de Software** (CEUB, 2026). É uma cópia do código do Pit Stop com a camada de qualidade; o repositório original do produto não foi alterado.

Equipe: Nathan Gerken, Gustavo Pereira de Sousa e Bernardo Gontijo.

**Escopo:** Node.js 20, Express, EJS e SQLite (`better-sqlite3`). Sessão guardada no próprio SQLite, senhas com bcrypt, proteção CSRF por token de sessão e limite de tentativas de login. Os dados ficam num arquivo SQLite local; no plano grátis do Render esse arquivo não sobrevive a um novo deploy.

## Documentação da solução

A documentação do produto, feita ao longo do semestre, está no repositório institucional [CAMPUSCEUB/PitStop](https://github.com/CAMPUSCEUB/PitStop) (acesso pela organização CEUB):

- [Requisitos](https://github.com/CAMPUSCEUB/PitStop/blob/main/docs/requisitos.md): RF-01 a RF-18 e RNF-01 a RNF-11, com critérios de aceitação.
- [Arquitetura](https://github.com/CAMPUSCEUB/PitStop/blob/main/docs/arquitetura.md) e [decisões técnicas (ADRs)](https://github.com/CAMPUSCEUB/PitStop/tree/main/docs/decisoes).
- [Arquitetura da informação](https://github.com/CAMPUSCEUB/PitStop/blob/main/docs/arquitetura-informacao.md), [protótipos](https://github.com/CAMPUSCEUB/PitStop/tree/main/docs/prototipo) e [storyboard](https://github.com/CAMPUSCEUB/PitStop/blob/main/docs/storyboard.md).
- [EAP](https://github.com/CAMPUSCEUB/PitStop/blob/main/docs/eap.md), [roadmap](https://github.com/CAMPUSCEUB/PitStop/blob/main/docs/roadmap.md) e [plano de testes de integração](https://github.com/CAMPUSCEUB/PitStop/blob/main/docs/testes-integracao.md), de onde vêm os IDs IT-xx usados aqui.

Este repositório guarda a camada de testes e a esteira; os cenários estão em [`docs/cenarios-de-teste.md`](docs/cenarios-de-teste.md).

## Execução

Requisitos: Node.js 20 ou mais novo e npm. Na pasta do projeto:

```bash
npm ci
npm start
```

Servidor em `http://localhost:3000`. Conta de demonstração: `aluno` / `senha123`. As variáveis estão em `.env.example` (`PORT`, `NODE_ENV`, `SESSION_SECRET`); em produção, `SESSION_SECRET` é obrigatória e o servidor encerra sem ela.

```bash
npm test                  # unitários + integração
npm run test:unit         # só as regras puras
npm run test:integration  # HTTP + sessão + banco
npm run test:coverage     # com relatório em coverage/ e limite mínimo
npm run test:e2e          # navegador real (Chrome ou Edge)
```

O E2E procura o Chrome nos caminhos comuns de Windows, Linux e macOS. Se não achar, defina `CHROME_PATH` com o caminho do executável.

## Estratégia de testes

| Tipo | O que protege | Ferramenta | Quantos |
|---|---|---|---|
| Unitário | Regras puras: situação do carro (fronteira dos 30 dias), soma de gastos em centavos e número do laudo | Jest | 32 |
| Integração | Rota → sessão → CSRF → banco → regra, com dois usuários reais para provar o isolamento de dados | Jest + Supertest | 62 |
| E2E | Jornada completa no navegador: criar conta, cadastrar carro, manutenção vencida, laudo, teclado e A+ | Jest + Puppeteer | 7 |

Cada arquivo de teste usa um banco SQLite **em memória e só dele** (`DB_PATH=':memory:'`): os testes não dependem de ordem, não sujam o banco de desenvolvimento e podem rodar em paralelo. A justificativa de cada tipo, os 101 cenários e o antes e depois das correções estão em [`docs/cenarios-de-teste.md`](docs/cenarios-de-teste.md).

### Os testes acharam defeitos

Os testes de integração foram escritos antes das correções. Rodados sobre o código original: **18 falhas em 62**. Os principais:

| Teste | Defeito | Situação |
|---|---|---|
| IT-28, IT-29 | Um usuário apagava manutenções e revisões de outro pelo `id` | Corrigido |
| IT-40 | `DELETE /api/veiculos/:id` apagava o histórico de manutenção de outro usuário antes de conferir o dono | Corrigido (achado novo) |
| IT-37 | Depois que um prazo vencia, o carro ficava "atrasado" para sempre | Corrigido |
| IT-33 | O número do laudo se repetia depois de uma exclusão | Corrigido |
| IT-36 | Excluir o carro deixava revisões órfãs | Corrigido |
| IT-38, IT-39 | Cadastros sem marca, sem data ou com valor negativo eram aceitos | Corrigido |

### Resultado da última execução local

Node.js 24.19.0, Windows 11, 26/11/2026:

```text
Tests:       94 passed, 94 total     (npm test: unitários + integração)
Tests:       7 passed, 7 total       (npm run test:e2e, Chrome headless)
```

Cobertura (`npm run test:coverage`): `regras.js` com **100% de linhas, ramos e funções** (o limite mínimo configurado barra o build abaixo disso). O projeto todo fica em cerca de 80% das linhas; o que falta é principalmente a migração antiga de `db.json` e rotas de páginas. Cobertura não é a meta: a meta é cada risco do produto ter um teste que falha quando o defeito volta.

## Pipeline — `.github/workflows/CI.yaml`

Escolha adotada: **GitHub Actions**, no caminho que o GitHub reconhece.

```text
push / pull request
  └─ testes        unitários + integração com cobertura (artefato coverage/)
       └─ e2e      jornada no Chrome do runner
            └─ build    docker build (a imagem roda os testes de novo)
                 └─ deploy   só na main: Render publica a imagem do commit; o smoke test espera /health informar esse commit
```

- Uma etapa só roda se a anterior passou. Em pull request a pipeline verifica e **nunca publica**.
- A imagem é marcada com o SHA do commit (`pitstop:<sha>`), para responder "qual commit está no ar?".
- **Quality gate de verdade:** em `Settings > Branches`, proteja a `main` e marque os checks `Testes unitários e de integração`, `Testes E2E (Chrome)` e `Build da imagem Docker` como obrigatórios. Sem isso, um teste vermelho só avisa e não bloqueia o merge.

Configuração em `Settings > Secrets and variables > Actions`:

| Tipo | Nome | Para quê |
|---|---|---|
| Secret | `RENDER_DEPLOY_HOOK_URL` | Deploy Hook do serviço no Render (Settings do serviço > Deploy Hook) |
| Variable | `APP_URL` | Endereço público da aplicação, usado no smoke test |
| Secret | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Opcional: publicar a imagem no Docker Hub |
| Variable | `DOCKERHUB_PUSH_ENABLED` | `true` para publicar no Docker Hub; padrão `false` |

No Render, o serviço é criado a partir da **imagem do Docker Hub** (New → Web Service → Existing Image, `docker.io/guxtavoo/pitstop`). A pipeline chama o Deploy Hook com o parâmetro `imgURL` apontando para a tag do commit: o Render roda exatamente a imagem que passou nos testes (construa uma vez, promova a mesma imagem). Deixe o **Auto-Deploy desligado**, para que só a pipeline publique versões.

## Docker

```bash
docker build -t pitstop:local .
docker run --rm -p 3000:3000 -e SESSION_SECRET=troque-isto pitstop:local
```

O Dockerfile tem dois estágios. O primeiro instala tudo e roda `npm test`; a imagem final só existe se ele passar. A imagem final leva só as dependências de produção, roda com o usuário `node` e tem `HEALTHCHECK` em `/health`. O Docker não estava instalado no computador onde o projeto foi preparado: o build da imagem é verificado na pipeline.

## APIs testadas

| Método | Rota | Sucesso | Erros cobertos |
|---|---|---|---|
| POST | `/api/cadastro` | 201 | 400, 409, 429 |
| POST | `/api/login` | 200 | 400, 401, 429 |
| GET | `/api/veiculos` | 200 | 401 |
| POST | `/api/veiculos` | 200 | 400, 401, 403 (CSRF) |
| PUT, PATCH | `/api/veiculos/:id`, `/api/veiculos/:id/status` | 200 | `ok: false` em veículo alheio |
| DELETE | `/api/veiculos/:id` | 200 | 404 |
| POST | `/api/veiculos/:id/foto` | 200 | 400 (extensão não permitida) |
| POST | `/api/manut/:vid` | 200 | 400 |
| DELETE | `/api/manut/:id` | 200 | 404 (inclusive de outro usuário) |
| POST | `/api/revisoes` | 200 com `numero_doc` | 400 |
| DELETE | `/api/revisoes/:id` | 200 | 404 (inclusive de outro usuário) |
| PUT | `/api/perfil/senha` | 200 | senha atual errada |
| GET | `/health` | 200 `{ "ok": true, "versao": "<sha do commit>" }` | — |

## Estrutura

- `regras.js`: regras de negócio puras (situação, gastos, número do laudo), testadas sem banco.
- `db.js`: esquema, consultas e transações; `DB_PATH` escolhe o arquivo do banco.
- `server.js` e `routes/`: aplicação Express.
- `views/` e `public/`: telas EJS, CSS e JavaScript do navegador; `landing3d/` é o código-fonte do carro 3D da página inicial.
- `tests/unit/`, `tests/integration/`, `tests/e2e/`: os três níveis de teste; `tests/helpers.js` e `tests/setup-env.js` preparam cada arquivo.
- `jest.e2e.config.js`: configuração só do E2E.
- `Dockerfile` e `.dockerignore`: imagem com testes obrigatórios.
- `.github/workflows/CI.yaml`: testes, E2E, build e deploy.
- `docs/cenarios-de-teste.md`: cenários, justificativas e resultados.

## Referências

- [Jest](https://jestjs.io/docs/getting-started) e [Supertest](https://github.com/ladjs/supertest)
- [Puppeteer](https://pptr.dev/)
- [GitHub Actions — sintaxe de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Render — Deploy Hooks](https://render.com/docs/deploy-hooks)
