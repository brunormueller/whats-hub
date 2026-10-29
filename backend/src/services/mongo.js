/**
 * Conexão com o MongoDB — a base única do produto.
 *
 * É um SaaS de base compartilhada: não existe banco (nem coleção) por cliente.
 * Cada documento de atendimento carrega `accountId`, e toda query filtra por
 * ele. O isolamento entre clientes é responsabilidade das funções de
 * `store.js`, que exigem a conta e recusam ser chamadas sem ela.
 *
 * `connect()` roda no boot, ANTES do servidor aceitar requisição: subir sem
 * banco só trocaria um erro claro na inicialização por 500 em toda rota.
 */
import { MongoClient } from 'mongodb';

const URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB || 'whatsapp_hub';

const client = new MongoClient(URL);

let database = null;

export async function connect() {
  if (database) return database;

  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      `MongoDB inacessível em ${URL.replace(/\/\/[^@]*@/, '//***@')} — o container está rodando? (${cause.message})`,
      { cause },
    );
  }

  database = client.db(DB_NAME);
  console.log(`🍃 MongoDB conectado (${DB_NAME})`);

  return database;
}

export async function close() {
  database = null;
  await client.close();
}

function db() {
  if (!database) {
    throw new Error('MongoDB ainda não conectado — chame connect() no boot');
  }
  return database;
}

/* ------------------------------------------------------------------ *
 * Coleções
 * ------------------------------------------------------------------ */

export const accounts = () => db().collection('accounts');
export const conversations = () => db().collection('conversations');
export const messages = () => db().collection('messages');
export const leads = () => db().collection('leads');
export const aiConfigs = () => db().collection('aiConfigs');
export const passwordResets = () => db().collection('passwordResets');

/**
 * Projeção padrão das leituras que vão para o front: `_id` e `accountId` são
 * mecânica interna, e a conta não precisa receber de volta o próprio id em
 * cada documento.
 */
export const PUBLIC = { _id: 0, accountId: 0 };

/* ------------------------------------------------------------------ *
 * Índices
 *
 * Os únicos não são otimização: são o que substitui as chaves do Redis como
 * garantia de unicidade. `accounts.email` é o que impede duas contas com o
 * mesmo e-mail em cadastros simultâneos (antes era HSETNX).
 * ------------------------------------------------------------------ */

export async function ensureIndexes() {
  await Promise.all([
    accounts().createIndex({ email: 1 }, { unique: true }),
    accounts().createIndex({ instanceName: 1 }, { unique: true }),

    conversations().createIndex({ accountId: 1, phoneNumber: 1 }, { unique: true }),
    conversations().createIndex({ accountId: 1, lastTimestamp: -1 }),

    messages().createIndex({ accountId: 1, phoneNumber: 1, timestamp: 1 }),

    leads().createIndex({ accountId: 1, phoneNumber: 1 }, { unique: true }),
    leads().createIndex({ accountId: 1, updatedAt: -1 }),

    // TTL: o Mongo apaga o link assim que `expiresAt` passa (a varredura roda
    // a cada ~60s, por isso a leitura também filtra por `expiresAt`).
    passwordResets().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    passwordResets().createIndex({ accountId: 1, createdAt: -1 }),
  ]);
}

export default db;
