// Configuração só dos testes E2E: navegador de verdade (Chrome/Edge via puppeteer-core).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // a sessão em SQLite mantém um timer de limpeza aberto; o Jest encerra mesmo assim
  forceExit: true,
};
