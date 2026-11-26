// Testes unitários das regras puras (regras.js): sem banco, sem HTTP, com "hoje" fixo.
const { paraDia, classificarPrazo, prazoVigente, situacaoDoVeiculo, somarGastos, numeroDoLaudo } = require('../../regras');

const HOJE = new Date(2026, 9, 15); // 15/10/2026, horário local

describe('paraDia — leitura de datas AAAA-MM-DD', () => {
  it('UT-01 aceita data válida e data com horário', () => {
    expect(paraDia('2026-10-15')).toBe(Date.UTC(2026, 9, 15));
    expect(paraDia('2026-10-15T23:59:00')).toBe(Date.UTC(2026, 9, 15));
  });
  it.each([[null], [''], ['15/10/2026'], ['2026-02-30'], ['2026-13-01'], ['abc']])(
    'UT-02 rejeita %p', valor => expect(paraDia(valor)).toBeNull());
});

describe('classificarPrazo — RF-11, fronteiras dos 30 dias', () => {
  it.each([
    ['sem próxima data', null, 'ok'],
    ['data inválida', '2026-02-30', 'ok'],
    ['venceu ontem', '2026-10-14', 'critico'],
    ['vence hoje', '2026-10-15', 'aviso'],
    ['vence amanhã', '2026-10-16', 'aviso'],
    ['vence em 30 dias (limite)', '2026-11-14', 'aviso'],
    ['vence em 31 dias', '2026-11-15', 'ok'],
  ])('UT-03 %s → %s', (_, data, tipo) => {
    expect(classificarPrazo(data, HOJE).tipo).toBe(tipo);
  });

  it('UT-04 o texto acompanha o tipo (estado nunca só por cor)', () => {
    expect(classificarPrazo('2026-10-14', HOJE).texto).toBe('Revisão atrasada');
    expect(classificarPrazo('2026-10-20', HOJE).texto).toBe('Revisão próxima');
    expect(classificarPrazo(null, HOJE).texto).toBe('Em dia');
  });
});

describe('prazoVigente e situacaoDoVeiculo — IT-37 em nível de unidade', () => {
  it('UT-05 sem serviços não há prazo', () => {
    expect(prazoVigente([])).toBeNull();
    expect(situacaoDoVeiculo([], HOJE).tipo).toBe('ok');
  });

  it('UT-06 vale o prazo do serviço mais recente', () => {
    const servicos = [
      { data: '2026-01-10', proxima_data: '2026-07-10' }, // antigo e vencido
      { data: '2026-09-18', proxima_data: '2027-03-18' }, // novo e futuro
    ];
    expect(prazoVigente(servicos)).toBe('2027-03-18');
    expect(situacaoDoVeiculo(servicos, HOJE).tipo).toBe('ok');
  });

  it('UT-07 só o serviço antigo vencido deixa o carro atrasado', () => {
    expect(situacaoDoVeiculo([{ data: '2026-01-10', proxima_data: '2026-07-10' }], HOJE).tipo).toBe('critico');
  });

  it('UT-08 serviço mais recente sem próxima data deixa o carro em dia', () => {
    const servicos = [
      { data: '2026-01-10', proxima_data: '2026-07-10' },
      { data: '2026-10-01', proxima_data: null },
    ];
    expect(situacaoDoVeiculo(servicos, HOJE).tipo).toBe('ok');
  });

  it('UT-09 empate de data: vale o prazo mais distante', () => {
    const servicos = [
      { data: '2026-10-01', proxima_data: '2026-10-20' },
      { data: '2026-10-01', proxima_data: '2027-04-01' },
    ];
    expect(prazoVigente(servicos)).toBe('2027-04-01');
  });

  it('UT-10 serviço sem data válida é ignorado', () => {
    const servicos = [
      { data: 'sem data', proxima_data: '2030-01-01' },
      { data: '2026-01-10', proxima_data: '2026-07-10' },
    ];
    expect(situacaoDoVeiculo(servicos, HOJE).tipo).toBe('critico');
  });
});

describe('somarGastos — dinheiro sem erro de ponto flutuante', () => {
  it('UT-11 lista vazia soma zero', () => expect(somarGastos([])).toBe(0));
  it('UT-12 0,10 + 0,20 dá exatamente 0,30', () => {
    expect(somarGastos([{ custo: 0.1 }, { custo: 0.2 }])).toBe(0.3);
  });
  it('UT-13 ignora custo nulo, negativo e não numérico; aceita texto numérico', () => {
    expect(somarGastos([{ custo: null }, { custo: -50 }, { custo: 'abc' }, { custo: '10.50' }, { custo: 420 }])).toBe(430.5);
  });
});

describe('numeroDoLaudo — IT-33 em nível de unidade', () => {
  it('UT-14 formata com três dígitos e cresce além deles', () => {
    expect(numeroDoLaudo(7, 2026)).toBe('REV-2026-007');
    expect(numeroDoLaudo(1234, 2026)).toBe('REV-2026-1234');
  });
  it.each([[0], [-1], [1.5], [NaN]])('UT-15 rejeita id %p', id => {
    expect(() => numeroDoLaudo(id, 2026)).toThrow(RangeError);
  });
});

describe('Valores padrão e entradas ausentes', () => {
  it('UT-16 sem "hoje" explícito usa a data atual', () => {
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    const p = x => String(x).padStart(2, '0');
    const iso = `${ontem.getFullYear()}-${p(ontem.getMonth() + 1)}-${p(ontem.getDate())}`;
    expect(classificarPrazo(iso).tipo).toBe('critico');
    expect(situacaoDoVeiculo([{ data: iso, proxima_data: iso }]).tipo).toBe('critico');
  });
  it('UT-17 lista ausente não quebra', () => {
    expect(prazoVigente(undefined)).toBeNull();
    expect(somarGastos(undefined)).toBe(0);
  });
  it('UT-18 empate de data com um prazo vazio: vale o que tem prazo', () => {
    const servicos = [{ data: '2026-10-01', proxima_data: null }, { data: '2026-10-01', proxima_data: '2026-10-20' }];
    expect(prazoVigente(servicos)).toBe('2026-10-20');
    expect(prazoVigente([...servicos].reverse())).toBe('2026-10-20');
  });
});
