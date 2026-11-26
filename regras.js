// Regras de negócio puras do Pit Stop: sem banco, sem HTTP e sem relógio implícito.
// Recebem a data de "hoje" como parâmetro para que os testes unitários sejam determinísticos.

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_DE_AVISO = 30;

const EM_DIA = Object.freeze({ tipo: 'ok', texto: 'Em dia' });
const PROXIMA = Object.freeze({ tipo: 'aviso', texto: 'Revisão próxima' });
const ATRASADA = Object.freeze({ tipo: 'critico', texto: 'Revisão atrasada' });

// "2026-09-25" (ou "2026-09-25T10:00") → milissegundos UTC do dia; inválido → null.
function paraDia(valor) {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(ano, mes - 1, dia);
  const d = new Date(t);
  // rejeita datas que o Date "conserta", como 2026-02-30
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return t;
}

const diaDeHoje = hoje => Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

// RF-11: situação de um prazo. Vencido antes de hoje = atrasada; até 30 dias = próxima.
function classificarPrazo(proximaData, hoje = new Date()) {
  const prazo = paraDia(proximaData);
  if (prazo === null) return EM_DIA;
  const h = diaDeHoje(hoje);
  if (prazo < h) return ATRASADA;
  if (prazo <= h + DIAS_DE_AVISO * DIA_MS) return PROXIMA;
  return EM_DIA;
}

// IT-37: vale o prazo do serviço mais recente (manutenções e revisões juntas).
// Um serviço novo substitui o prazo de um serviço antigo, mesmo que o antigo tenha vencido.
function prazoVigente(servicos) {
  const validos = (servicos || []).filter(s => paraDia(s.data) !== null);
  if (!validos.length) return null;
  validos.sort((a, b) =>
    (paraDia(b.data) - paraDia(a.data)) ||
    ((paraDia(b.proxima_data) ?? -Infinity) - (paraDia(a.proxima_data) ?? -Infinity)));
  return validos[0].proxima_data || null;
}

function situacaoDoVeiculo(servicos, hoje = new Date()) {
  return classificarPrazo(prazoVigente(servicos), hoje);
}

// Soma em centavos inteiros para não acumular erro de ponto flutuante (0,1 + 0,2).
function somarGastos(registros) {
  const centavos = (registros || []).reduce((s, r) => {
    const v = Number(r.custo);
    return s + (Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0);
  }, 0);
  return centavos / 100;
}

// IT-33: número do laudo a partir do id AUTOINCREMENT, que o SQLite nunca reaproveita.
function numeroDoLaudo(id, ano) {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('id do laudo inválido');
  return `REV-${ano}-${String(id).padStart(3, '0')}`;
}

module.exports = { paraDia, classificarPrazo, prazoVigente, situacaoDoVeiculo, somarGastos, numeroDoLaudo, DIAS_DE_AVISO };
