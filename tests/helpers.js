const request = require('supertest');

const SENHA = 'senha123';

// Data relativa a hoje no formato AAAA-MM-DD (fuso local, como o input type="date").
function diasAPartirDeHoje(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Cria um usuário novo e devolve um agente com a sessão dele (cookie guardado).
async function novoUsuario(app, usuario) {
  const agente = request.agent(app);
  const r = await agente.post('/api/cadastro').send({ usuario, senha: SENHA, senha2: SENHA, nome: usuario });
  if (r.status !== 201) throw new Error(`cadastro de ${usuario} falhou: ${r.status}`);
  return agente;
}

async function novoVeiculo(agente, extra = {}) {
  const r = await agente.post('/api/veiculos').send({ marca: 'Fiat', modelo: 'Argo', ano: '2024', km: '1000', ...extra });
  if (!r.body.ok) throw new Error('cadastro de veículo falhou');
  return r.body.id;
}

module.exports = { request, SENHA, diasAPartirDeHoje, novoUsuario, novoVeiculo };
