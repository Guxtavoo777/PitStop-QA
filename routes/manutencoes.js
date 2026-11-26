const express = require('express');
const { stmts } = require('../db');
const { paraDia } = require('../regras');

const router = express.Router();

router.post('/api/manut/:vid', (req, res) => {
  const vid = parseInt(req.params.vid);
  const v = stmts.getVeiculo.get(vid, req.session.user);
  if (!v) return res.json({ ok: false });

  const { tipo, descricao, oficina, km_na_revisao, custo, data, proxima_km, proxima_data } = req.body;
  if (!tipo || typeof tipo !== 'string' || !tipo.trim())
    return res.status(400).json({ ok: false, msg: 'Informe o tipo do serviço.' });
  if (paraDia(data) === null)
    return res.status(400).json({ ok: false, msg: 'Informe a data do serviço (AAAA-MM-DD).' });
  if (proxima_data && paraDia(proxima_data) === null)
    return res.status(400).json({ ok: false, msg: 'Próxima data inválida.' });
  if (custo !== undefined && custo !== '' && !(Number(custo) >= 0))
    return res.status(400).json({ ok: false, msg: 'O valor não pode ser negativo.' });
  const info = stmts.insertManutencao.run({
    veiculo_id: vid, tipo, descricao: descricao || '', oficina: oficina || '',
    km_na_revisao: km_na_revisao || '', custo: parseFloat(custo) || 0,
    data, proxima_km: proxima_km || null, proxima_data: proxima_data || null,
  });
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.delete('/api/manut/:id', (req, res) => {
  const info = stmts.deleteManutencao.run(parseInt(req.params.id), req.session.user);
  if (info.changes === 0) return res.status(404).json({ ok: false, msg: 'Manutenção não encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
