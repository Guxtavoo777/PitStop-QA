# Cenários de teste — Pit Stop

Documento da disciplina Teste e Qualidade de Software (CEUB, 2026). Liga cada risco do produto a um teste automatizado, ao tipo de teste escolhido e à etapa da pipeline que o executa.

## Estratégia: por que estes três tipos

O Pit Stop guarda o histórico de manutenção de cada carro de cada usuário. Os riscos que mais custam, em ordem, são:

1. **Um usuário mexer nos dados de outro** (RF-14). É falha de segurança e de confiança.
2. **O carro aparecer com a situação errada** (RF-11). O produto existe para avisar a revisão; um alerta errado é o defeito mais visível.
3. **Perder ou corromper dados** em exclusões e cadastros (RF-05, RF-07, RF-10).
4. **A jornada principal quebrar no navegador**, inclusive para quem usa teclado ou texto grande.

| Tipo | Para qual risco | Por que este tipo | Ferramenta | Quantos |
|---|---|---|---|---|
| Unitário | 2 e parte do 3: regras de prazo, soma de gastos e número do laudo | São regras puras com fronteiras (30 dias, ontem/hoje, centavos). O teste unitário cobre cada fronteira em milissegundos e com a data de "hoje" fixa, sem depender do relógio | Jest | 32 |
| Integração | 1, 2 e 3: rota → sessão → CSRF → banco → regra | O defeito de isolamento só aparece com sessão real, dois usuários e o banco. Supertest sobe a aplicação em memória, e cada arquivo de teste usa um SQLite próprio, criado do zero | Jest + Supertest | 62 |
| E2E | 4: cadastro, garagem, manutenção, laudo, teclado e A+ | Prova que as telas, o JavaScript do navegador e o CSRF funcionam juntos, como a pessoa usa | Jest + Puppeteer (Chrome real) | 7 |

**Total: 101 testes automatizados.** Testes de contrato e de carga ficaram de fora: o Pit Stop não expõe API para terceiros e é um projeto de uso individual, sem meta de carga definida.

## Antes e depois: os testes acharam defeitos reais

Os testes de integração foram escritos **antes** das correções e rodados contra o código original. Resultado da execução sobre o código original: **18 falhas em 62 testes**. Depois das correções, os 62 passam. Os testes ficam na suíte como regressão.

| Teste | Defeito no código original | Correção |
|---|---|---|
| IT-28 | Qualquer usuário logado apagava a manutenção de outro pelo `id` | Exclusão filtrada pelo dono do veículo; responde 404 |
| IT-29 | O mesmo, para revisões | Idem |
| IT-40 | **Defeito novo, achado pelos testes:** `DELETE /api/veiculos/:id` apagava todas as manutenções do veículo antes de conferir o dono. Outro usuário zerava o histórico alheio | Exclusão numa transação, só depois de conferir o dono |
| IT-36 | Excluir o veículo deixava as revisões dele órfãs no banco | A transação remove manutenções e revisões |
| IT-37, IT-45 | Depois que um prazo vencia, o carro ficava "atrasado" para sempre; revisões não contavam | Vale o prazo do serviço mais recente, somando manutenções e revisões |
| IT-33 | O número do laudo vinha de `COUNT(*)` e se repetia depois de uma exclusão | O número sai do id `AUTOINCREMENT`, que o SQLite nunca reaproveita |
| IT-38, IT-39, IT-47 | Veículo sem marca, manutenção sem data e valor negativo eram aceitos | Validação na rota, com 400 e mensagem |
| IT-43 | Excluir veículo inexistente respondia `ok: true` | Responde 404 |

## Cenários unitários (`tests/unit/regras.test.js`)

"Hoje" fixo em 15/10/2026 nos casos de fronteira.

| ID | Cenário | Resultado esperado |
|---|---|---|
| UT-01 | Data `AAAA-MM-DD`, com ou sem horário | Lida corretamente |
| UT-02 | `null`, vazio, `15/10/2026`, `2026-02-30`, mês 13, texto | Rejeitada (6 casos) |
| UT-03 | Prazo ausente, inválido, ontem, hoje, amanhã, em 30 e em 31 dias | ok, ok, atrasada, próxima, próxima, próxima, ok (7 casos) |
| UT-04 | Cada situação vem com texto | "Em dia", "Revisão próxima", "Revisão atrasada" |
| UT-05 | Carro sem serviços | Sem prazo, em dia |
| UT-06 | Serviço antigo vencido + serviço novo com prazo futuro | Em dia |
| UT-07 | Só o serviço antigo vencido | Atrasada |
| UT-08 | Serviço mais recente sem próxima data | Em dia |
| UT-09 | Dois serviços no mesmo dia | Vale o prazo mais distante |
| UT-10 | Serviço com data inválida | Ignorado |
| UT-11 a UT-13 | Soma de gastos: vazia, 0,10 + 0,20, valores nulos, negativos e texto | 0; exatamente 0,30; só os válidos |
| UT-14, UT-15 | Número do laudo: 7, 1234; ids 0, −1, 1,5, NaN | `REV-2026-007`, `REV-2026-1234`; erro (4 casos) |
| UT-16 a UT-18 | Sem "hoje" explícito, lista ausente, empate com prazo vazio | Usa a data atual; não quebra; vale o que tem prazo |

## Cenários de integração (`tests/integration/`)

| ID | Requisito | Cenário | Resultado esperado |
|---|---|---|---|
| IT-01 | RF-02 | Login com senha errada | 401 |
| IT-02 | RF-02 | Login sem senha | 400 |
| IT-03 | RF-01, RNF-01 | Cadastro novo | 201, sessão aberta, senha guardada com hash bcrypt |
| IT-04 | RF-01 | Usuário repetido | 409 |
| IT-05, IT-06 | RF-01 | Senhas diferentes; senha curta | 400 |
| IT-07 | RF-02 | Login da conta de demonstração | 200 |
| IT-08 | RF-03 | Logout | Redireciona e a sessão deixa de valer |
| IT-09 a IT-12 | RNF-04 | Garagem, API e perfil sem sessão | Redireciona ou 401, sem gravar nada |
| IT-13 a IT-20 | RF-04, RF-05 | Listar, criar, editar, alternar ativo e excluir veículo | Efeito confirmado no banco |
| IT-21 a IT-23 | RF-07, RF-08 | Criar, recusar em veículo inexistente e excluir manutenção | Efeito confirmado no banco |
| IT-24, IT-25 | RNF-08 | Página inicial e 7 telas internas | 200, link "Pular para o conteúdo" e botões A−/A/A+ (8 casos) |
| IT-27 | — | Rota inexistente | 404 |
| IT-28 a IT-30 | RF-14 | Outro usuário tenta apagar manutenção, apagar revisão e listar veículos do dono | 404 e nada muda; lista vazia |
| IT-31 | RNF-02 | Escrita sem token CSRF, com a verificação ligada | 403 e nada gravado |
| IT-32 | RNF-03 | 21 tentativas de login | As 20 primeiras 401, a 21ª 429 |
| IT-33 | RF-10 | Número do laudo depois de excluir outra revisão | Três números diferentes |
| IT-34, IT-41 | RF-13 | Troca de senha com a atual errada; com a certa | Recusada; trocada |
| IT-35 | RF-06 | Upload de `.exe` como foto | 400 e a foto não muda |
| IT-36 | RF-05 | Excluir veículo com manutenção e revisão | Os três somem |
| IT-37 | RF-11 | Prazo vencido seguido de serviço novo com prazo futuro | Atrasado → em dia |
| IT-38 | RF-04 | Veículo sem marca, sem modelo, marca em branco, km negativa | 400 e nada gravado (4 casos) |
| IT-39 | RF-07 | Manutenção sem data, data em outro formato, sem tipo, valor negativo, próxima data impossível | 400 (5 casos) |
| IT-40 | RF-14 | Outro usuário exclui o veículo do dono pelo id | 404; veículo, manutenção e revisão continuam |
| IT-42 | RNF-02 | Escrita com o token CSRF da página | Aceita |
| IT-43 | RF-05 | Excluir veículo inexistente | 404 |
| IT-44 | RF-12 | 0,10 + 0,20 + 100 em manutenções | Total exato de 100,30 |
| IT-45 | RF-11 | Revisão recente com prazo em 10 dias | "Revisão próxima" |
| IT-46 | RF-11 | Garagem de carro atrasado | O texto "Revisão atrasada" aparece na página |
| IT-47 | RF-09 | Revisão sem data | 400 |
| IT-48 | RF-10 | Laudo aberto pelo dono | 200 com o número do documento |
| IT-49, IT-50 | RF-14 | Outro usuário registra manutenção, edita, abre a ficha e o laudo do dono | Recusado ou redirecionado |
| IT-51 | Operação | `/health` sem sessão | 200 `{ ok: true, versao }`: a versão é o SHA do commit gravado na imagem |

## Cenários E2E (`tests/e2e/jornada.e2e.test.js`)

Chrome sem interface, aplicação real com CSRF ligado e banco em memória. Os casos rodam em sequência, como uma pessoa usando o site.

| ID | Jornada | Resultado esperado |
|---|---|---|
| E2E-01 | Visitante abre a página inicial e cria a conta pela janela de acesso | Chega ao painel com o nome de usuário |
| E2E-02 | Busca "Corolla" no catálogo, escolhe e informa a km | O carro aparece na garagem |
| E2E-03 | Registra manutenção com a próxima data já vencida | A ficha mostra "Revisão atrasada" escrito |
| E2E-04 | Faz uma revisão nova com prazo futuro | Laudo `REV-AAAA-NNN` gerado; o carro sai do atraso |
| E2E-05 | Aperta Tab ao abrir a garagem | O foco vai para "Pular para o conteúdo" |
| E2E-06 | Clica em A+ e recarrega a página | O texto aumenta e o tamanho continua depois de recarregar |
| E2E-07 | Sai da conta e tenta abrir a garagem | Volta para a página inicial |

## Exploração manual (fora da automação)

O que a automação não decide sozinha e foi conferido à mão nas apresentações: contraste das cores (WCAG AA), leitura com leitor de tela, a landing com o carro 3D em celular, e o comportamento com texto em 137,5%. O teste automatizado prova que o comportamento se repete; a exploração procura o que ninguém previu.

## Como os testes entram no processo

1. **Durante o desenvolvimento:** a regra nova nasce com o teste (as correções de IT-28, IT-29, IT-36, IT-37 e IT-40 seguiram vermelho → verde → refatoração).
2. **No pull request:** a pipeline roda unitários e integração com cobertura e, depois, o E2E. A proteção da branch `main` deve exigir esses checks para que um teste vermelho bloqueie o merge.
3. **No build:** o Dockerfile roda a suíte de novo num estágio próprio; se ela falha, a imagem não existe.
4. **No deploy:** só um push na `main` com todos os checks verdes dispara o deploy no Render; em seguida o smoke test confere `/health` na aplicação publicada.

Limite assumido: cobertura não é qualidade. `regras.js` tem 100% de linhas e de ramos porque é onde mora a regra crítica. O total do projeto (cerca de 80% das linhas) inclui rotas de páginas e a migração antiga de `db.json`, que pesam menos no risco.
