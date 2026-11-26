const express = require('express');
const path = require('path');
const multer = require('multer');
const { stmts, excluirVeiculo } = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../public/uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'v' + Date.now() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

router.get('/api/veiculos', (req, res) => {
  res.json(stmts.getVeiculos.all(req.session.user));
});

router.post('/api/veiculos', (req, res) => {
  const { marca, modelo, ano, km, img, cor, placa, motor, potencia, torque,
          cambio, tracao, combustivel, consumo_cidade, consumo_estrada,
          porta_malas, categoria, observacoes, preco_base } = req.body;
  if (typeof marca !== 'string' || !marca.trim() || typeof modelo !== 'string' || !modelo.trim())
    return res.status(400).json({ ok: false, msg: 'Informe a marca e o modelo.' });
  if (km !== undefined && km !== '' && !(Number(km) >= 0))
    return res.status(400).json({ ok: false, msg: 'A quilometragem não pode ser negativa.' });
  const info = stmts.insertVeiculo.run({
    usuario: req.session.user, marca, modelo, ano, km, img: img || '',
    cor: cor || '', placa: placa || '', motor, potencia, torque,
    cambio, tracao, combustivel, consumo_cidade, consumo_estrada,
    porta_malas, categoria, observacoes: observacoes || '', preco_base: preco_base || null,
  });
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/api/veiculos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const v = stmts.getVeiculo.get(id, req.session.user);
  if (!v) return res.json({ ok: false, msg: 'Veículo não encontrado.' });
  const { km, cor, placa, observacoes } = req.body;
  stmts.updateVeiculo.run({ km, cor, placa, observacoes: observacoes || '', id, usuario: req.session.user });
  res.json({ ok: true });
});

router.post('/api/veiculos/:id/foto', upload.single('foto'), (req, res) => {
  const id = parseInt(req.params.id);
  const v = stmts.getVeiculo.get(id, req.session.user);
  if (!v) return res.json({ ok: false, msg: 'Veículo não encontrado.' });
  if (!req.file) return res.status(400).json({ ok: false, msg: 'Nenhum arquivo enviado.' });
  const url = '/uploads/' + req.file.filename;
  stmts.updateVeiculoFoto.run(url, id, req.session.user);
  res.json({ ok: true, url });
});

router.patch('/api/veiculos/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const v = stmts.getVeiculo.get(id, req.session.user);
  if (!v) return res.json({ ok: false, msg: 'Veículo não encontrado.' });
  stmts.toggleAtivo.run(id, req.session.user);
  const updated = stmts.getVeiculo.get(id, req.session.user);
  res.json({ ok: true, ativo: updated.ativo === 1 });
});

router.delete('/api/veiculos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!excluirVeiculo(id, req.session.user))
    return res.status(404).json({ ok: false, msg: 'Veículo não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
