import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import webhookRouter from './routes/webhook.js';
import authRouter from './routes/auth.js';
import messagesRouter from './routes/messages.js';
import instanceRouter from './routes/instance.js';
import aiRouter from './routes/ai.js';
import leadsRouter from './routes/leads.js';
import metricsRouter from './routes/metrics.js';
import { setupSocket } from './services/socket.js';
import { authMiddleware, requireOnboarded } from './middleware/auth.js';
import { PROVIDER, isEvolution } from './services/provider.js';
import { aiRuntime } from './services/ai.js';
import { countAccounts } from './services/accounts.js';
import { connect, ensureIndexes } from './services/mongo.js';
import { mailConfigured } from './services/mailer.js';

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

// A Evolution API manda payloads grandes (sync de histórico, contatos,
// mídia em base64) — o padrão de 100kb do body-parser estoura.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '25mb' }));

// Rotas públicas (o provider entrega as mensagens aqui)
app.use('/webhook', webhookRouter);

// Cadastro e login — as únicas rotas de API sem sessão
app.use('/api/auth', authRouter);

// Pareamento do número: exige sessão, mas NÃO exige onboarding concluído —
// é justamente a tela que conclui o onboarding.
if (isEvolution) {
  app.use('/api/instance', authMiddleware, instanceRouter);
}

// O resto do produto só abre depois do WhatsApp conectado
const protected_ = [authMiddleware, requireOnboarded];

app.use('/api/messages', protected_, messagesRouter);
app.use('/api/ai', protected_, aiRouter);
app.use('/api/leads', protected_, leadsRouter);
app.use('/api/metrics', protected_, metricsRouter);

// Tratamento de erro final. Corpo ilegível no webhook responde 200 de
// propósito: sem body parseado não há nada a processar, e um 4xx só faria
// o provider reenviar o mesmo payload em loop.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const badBody = err.type === 'entity.too.large' || err.type === 'entity.parse.failed';

  if (badBody) {
    console.warn(`⚠️  Corpo rejeitado em ${req.method} ${req.originalUrl}: ${err.type} (${err.length ?? '?'} bytes)`);
    if (req.path.startsWith('/webhook') || req.originalUrl.startsWith('/webhook')) {
      return res.sendStatus(200);
    }
    return res.status(413).json({ error: 'Payload muito grande' });
  }

  console.error(`Erro em ${req.method} ${req.originalUrl}:`, err.message);
  res.status(500).json({ error: 'Erro interno' });
});

setupSocket(io);

const PORT = process.env.PORT || 3001;

/**
 * O banco conecta ANTES do listen: sem ele nenhuma rota funciona, e subir o
 * servidor de qualquer jeito só trocaria um erro claro aqui por 500 em toda
 * requisição. Índices na subida porque `createIndex` é idempotente — inclusive
 * os únicos, que são o que garante um e-mail por conta.
 */
async function start() {
  await connect();
  await ensureIndexes();

  const total = await countAccounts();

  httpServer.listen(PORT, () => {
    console.log(`🟢 Servidor rodando na porta ${PORT}`);
    console.log(`   Provider: ${PROVIDER}`);
    console.log(`   Webhook:  POST /webhook`);
    console.log(`   Auth:     POST /api/auth/signup  |  POST /api/auth/login  |  POST /api/auth/forgot-password`);
    console.log(`   API:      /api/messages  /api/leads  /api/metrics  (exigem WhatsApp conectado)`);
    console.log(`   E-mail:   ${mailConfigured() ? `SMTP ${process.env.SMTP_HOST}` : 'sem SMTP — e-mails vão para o console'}`);
    console.log(`   IA:       ${aiRuntime().configured ? `${aiRuntime().model} (effort ${aiRuntime().effort})` : 'desligada — falta ANTHROPIC_API_KEY'}`);

    if (isEvolution) {
      console.log(`   Instância: GET /api/instance  |  GET /api/instance/qr`);
    } else {
      console.log(`   Provider meta: um número para toda a instalação — multi-tenant só no provider evolution`);
    }

    console.log(`   Contas:   ${total}`);
  });
}

start().catch((err) => {
  console.error('❌ Falha ao subir o servidor:', err.message);
  process.exit(1);
});
