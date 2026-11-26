// Roda antes de cada arquivo de teste (jest "setupFiles").
// Cada arquivo carrega a aplicação de novo, com um banco SQLite em memória só dele.
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'segredo-de-teste-pitstop';
process.env.DB_PATH = ':memory:';
process.env.CSRF_DESATIVADO = '1';
