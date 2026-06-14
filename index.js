// =============================================================================
// WhatsApp AI Bot - Entry Point (Railway)
// =============================================================================
// Para uso local: node index.js
// Para uso no Railway: o servidor web é iniciado automaticamente
// =============================================================================

const dotenv = require('dotenv');
dotenv.config();

const { validateConfig } = require('./bot');

// Valida a configuração antes de iniciar
if (!validateConfig()) {
    process.exit(1);
}

// Inicia o servidor web (que também inicializa o bot WhatsApp)
require('./server');
