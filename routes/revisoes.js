const express = require('express');
const { stmts, db } = require('../db');
const { paraDia, numeroDoLaudo } = require('../regras');

const router = express.Router();

router.get('/api/revisoes', (req, res) => {
  const revs = stmts.getRevisoes.all(req.session.user).map(rv => ({
    ...rv,
    itens_revisados: JSON.parse(rv.itens_revisados || '{}'),
  }));
  res.json(revs);
});

router.post('/api/revisoes', (req, res) => {
  const { veiculo_id, tipo, descricao, oficina, mecanico, data, km_na_revisao,
          custo, proxima_data, proxima_km, status, observacoes, itens_revisados } = req.body;

  const vid = parseInt(veiculo_id);
  const v = stmts.getVeiculo.get(vid, req.session.user);
  if (!v) return res.json({ ok: false });
  if (paraDia(data) === null)
    return res.status(400).json({ ok: false, msg: 'Informe a data da revisão (AAAA-MM-DD).' });

  // IT-33: o número sai do id AUTOINCREMENT, que nunca se repete, nem depois de excluir outra revisão
  const criar = db.transaction(() => {
    const r = stmts.insertRevisao.run({
      veiculo_id: vid, usuario: req.session.user, numero_doc: '',
      tipo, descricao: descricao || '', oficina: oficina || '',
      mecanico: mecanico || '', data, km_na_revisao: km_na_revisao || '',
      custo: parseFloat(custo) || 0, proxima_data: proxima_data || null,
      proxima_km: proxima_km || null, status: status || 'aprovado',
      observacoes: observacoes || '',
      itens_revisados: JSON.stringify(itens_revisados || {}),
    });
    const id = Number(r.lastInsertRowid);
    const numero = numeroDoLaudo(id, new Date().getFullYear());
    stmts.setNumeroDoc.run(numero, id);
    return { id, numero };
  });
  const { id, numero } = criar();
  res.json({ ok: true, id, numero_doc: numero });
});

router.delete('/api/revisoes/:id', (req, res) => {
  const info = stmts.deleteRevisao.run(parseInt(req.params.id), req.session.user);
  if (info.changes === 0) return res.status(404).json({ ok: false, msg: 'Revisão não encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
