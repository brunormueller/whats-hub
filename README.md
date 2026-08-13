# WhatsApp Hub — Atendimento por WhatsApp com IA

Produto multi-conta: cada cliente se cadastra, conecta o próprio número de WhatsApp e ganha um painel em tempo real onde uma IA atende, coleta dados e escala para humanos. **React + Socket.IO** no frontend, **Express + MongoDB** no backend, com dois providers possíveis:

| `WHATSAPP_PROVIDER` | Provider | Número usado |
|---|---|---|
| `evolution` (padrão atual) | [Evolution API](https://doc.evolution-api.com) v2 | **seu próprio número**, pareado por QR code |
| `meta` | WhatsApp Cloud API | número oficial aprovado na Meta |

Trocar de provider é só mudar `WHATSAPP_PROVIDER` no `.env` e reiniciar — nada mais no código muda.

---

## Pré-requisitos

- Node.js 20+
- Docker — o banco do hub (MongoDB) sobe pelo `docker-compose.evolution.yml`, serviço `hub-mongo`
- **Provider `evolution`:** um número de WhatsApp no celular (a Evolution API sobe no mesmo compose)
- **Provider `meta`:** conta de desenvolvedor Meta com acesso à WhatsApp Cloud API

---

## Configuração do backend

```bash
# banco + Evolution API
docker compose -f docker-compose.evolution.yml up -d

cd backend
cp .env.example .env
npm install
npm run dev
```

O banco é o `MONGO_URL` do `.env` (padrão: o `hub-mongo` do compose). O servidor conecta e cria os índices **antes**
de abrir a porta — sem banco ele não sobe, em vez de responder 500 em toda rota.

Variáveis do `.env`:

| Variável | Provider | Onde encontrar |
|---|---|---|
| `WHATSAPP_PROVIDER` | ambos | `evolution` ou `meta` |
| `EVOLUTION_API_URL` | evolution | URL da Evolution API (`http://localhost:8080`). É o container onde as contas **novas** nascem — as existentes usam o `evolutionUrl` gravado nelas |
| `EVOLUTION_API_KEY` | evolution | igual a `AUTHENTICATION_API_KEY` do container |
| `EVOLUTION_WEBHOOK_URL` | evolution | URL do backend vista pelo container |
| `MONGO_URL` | ambos | banco do hub (`hub-mongo` do compose) |
| `MONGO_DB` | ambos | nome do banco (padrão `whatsapp_hub`) |
| `WHATSAPP_VERIFY_TOKEN` | meta | Você define (qualquer string secreta) |
| `WHATSAPP_ACCESS_TOKEN` | meta | Meta for Developers → seu app → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | meta | Mesmo painel, "Phone Number ID" |
| `JWT_SECRET` | ambos | Você gera: `openssl rand -hex 32`. Assina a sessão de login |
| `ANTHROPIC_API_KEY` | ambos | [console.anthropic.com](https://console.anthropic.com) — sem ela a IA fica desligada |

---

## Contas e multi-tenant

Não existe mais token de operador no `.env`. Cada cliente cria uma conta, e **uma conta é um tenant**.

É uma **base única compartilhada**: não existe banco nem coleção por cliente. Todo documento de atendimento carrega `accountId`, toda query filtra por ele, e nenhuma função de dados (`services/store.js`) aceita ser chamada sem conta — `undefined` é erro na hora, não query aberta.

| Coleção | Um documento por | Índice único |
|---|---|---|
| `accounts` | conta (`_id` = id da conta) | `email`, `instanceName` |
| `conversations` | conversa | `accountId` + `phoneNumber` |
| `messages` | mensagem | — (`accountId` + `phoneNumber` + `timestamp`) |
| `leads` | conversa | `accountId` + `phoneNumber` |
| `aiConfigs` | conta (`_id` = accountId) | — |

O índice único em `accounts.email` não é otimização: é o que impede duas contas com o mesmo e-mail em cadastros simultâneos (o `insertOne` que colide devolve `E11000`, e a rota traduz para 409).

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/auth/signup` | cria a conta e já devolve a sessão |
| `POST` | `/api/auth/login` | e-mail + senha |
| `GET` | `/api/auth/me` | conta da sessão + estado do onboarding |

- **Senha:** scrypt (N=32768, r=8, p=1) com salt por conta, via `crypto` do Node — sem dependência nova. O formato guardado carrega os parâmetros, então o custo pode subir depois sem invalidar as senhas existentes.
- **Sessão:** JWT HS256 de 30 dias assinado com `JWT_SECRET`. Sem estado no servidor — não há logout server-side; o front descarta o token. Sem `JWT_SECRET` o servidor sobe, avisa e usa chave aleatória (todo mundo cai no restart).
- **Socket.IO** usa o mesmo JWT e cada conexão entra na sala da própria conta: nenhum evento cruza tenants.

### Um número por conta

No provider `evolution`, cada conta recebe uma instância própria (`hub-<id>`) e pareia o próprio número. O webhook descobre de quem é a mensagem pelo campo `instance` do payload (`findByInstance`) — **uma única `EVOLUTION_WEBHOOK_URL` serve todas as contas**. Instância sem conta correspondente é ignorada com aviso no log.

Instância **não é container**: um container Evolution hospeda muitas sessões do Baileys. O container vazio custa **142 MB** (medido), e cada sessão conectada some ~80–200 MB por cima — o número real sai de `docker stats --no-stream evolution-api` antes e depois de parear. E o Evolution é um processo Node só: os sockets disputam um event loop, com a cripto do Signal serializada, então a degradação chega antes do teto de memória. Limite prático por container: **30–50 clientes**.

Por isso a conta guarda `evolutionUrl` além de `instanceName`. Hoje todas apontam para o mesmo container; quando entrar um segundo, as contas novas nascem apontando para ele e as antigas não se mexem — a sessão de um cliente vive no volume de um container só. Distribuir é `updateOne` no documento, não refactor: as funções de `services/evolution.js` recebem `{ instanceName, evolutionUrl }` (via `instanceTarget(account)`), e só caem no `.env` quando recebem uma string.

O Postgres da Evolution é dela, não do hub, e continua único para todos os containers. O compose desliga `DATABASE_SAVE_DATA_NEW_MESSAGE`/`MESSAGE_UPDATE`/`CONTACTS`/`CHATS`: o histórico é do hub (`messages`/`conversations`), e deixar ligado gravaria o mesmo dado em dois bancos.

> **Provider `meta` é single-tenant.** A Cloud API tem um `WHATSAPP_PHONE_NUMBER_ID` por instalação e o payload não identifica instância, então o webhook cai na única conta existente. Com mais de uma conta cadastrada a mensagem é recusada em vez de ir para a conta errada.

### Gate de onboarding

Depois de entrar, o primeiro passo é conectar o WhatsApp. Enquanto a conta não tem número pareado:

- o front mostra só a tela de conexão (`pages/Onboarding.jsx`), sem navegação e sem como fechar;
- o backend recusa `/api/messages`, `/api/ai`, `/api/leads` e `/api/metrics` com `403 { code: 'onboarding_required' }`;
- o Socket.IO nem abre a conexão.

`GET /api/instance` é a exceção — é a rota que conclui o onboarding: estado `open` grava `onboardedAt` na conta e libera o resto. No provider `meta` o gate é desligado (não há o que parear).

---

## Respostas automáticas com IA (Claude)

Toda mensagem recebida passa por `maybeAutoReply()`: o backend monta o **system prompt a partir da configuração publicada** na tela "Comportamento da IA" (persona, tom, criatividade, tópicos permitidos, guardrails, frases proibidas, fontes, horário e regras de handoff), chama a API da Anthropic e devolve a resposta pelo mesmo provider de WhatsApp.

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-5   # padrão
AI_EFFORT=medium                # low | medium | high | xhigh | max
AI_MAX_TOKENS=4096              # raciocínio + texto da resposta
AI_HISTORY_LIMIT=20             # mensagens de contexto por conversa
AI_TIMEZONE=America/Sao_Paulo   # usado para avaliar o horário de atendimento
```

Sem `ANTHROPIC_API_KEY` o servidor sobe normalmente — só não responde sozinho (o log de boot mostra `IA: desligada`).

### O que a IA decide

O modelo responde em JSON estruturado com `reply`, `handoff` e `handoff_reason`. **Handoff avisa, não para.** Quando o modelo marca handoff (cliente pediu atendente, assunto fora dos tópicos permitidos, guardrail que impediria a resposta), a conversa recebe `needsHuman: true` e o chip vira **"Escalada"** — mas a IA continua conduzindo o atendimento.

Quem tira a IA da conversa é o operador, gravando `aiPaused: true`:

- botão **"Assumir conversa"** no chat;
- ou simplesmente enviando uma mensagem, se `pauseOnOperatorReply` estiver ligado (padrão).

O chip vira **"Aguardando você"** e **"Reativar IA"** devolve a conversa.

| Config | Padrão | Efeito |
|---|---|---|
| `handoffPauses` | `false` | `true` volta ao comportamento antigo: escalar cala a IA |
| `pauseOnOperatorReply` | `true` | operador respondendo assume a conversa |

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/ai/config` | configuração publicada + modelo em uso |
| `PUT` | `/api/ai/config` | publica alterações (aceita patch parcial) |
| `POST` | `/api/ai/test` | sandbox da tela — não envia nada no WhatsApp |
| `POST` | `/api/ai/conversations/:phone/pause` | operador assume a conversa |
| `POST` | `/api/ai/conversations/:phone/resume` | devolve a conversa para a IA |

O switch **"IA ativa"** do inbox grava `autoReply` na configuração — desligado, nenhuma conversa recebe resposta automática.

> A criatividade do slider vira **instrução de texto** no prompt, não `temperature`: os modelos Claude 5.x rejeitam parâmetros de sampling com HTTP 400.

### Ritmo humano ("digitando…")

Antes de enviar, o backend acende o indicador de digitação e espera um tempo proporcional ao tamanho da resposta. Configurável em **Comportamento da IA → Persona e tom → Ritmo de resposta**:

| Config | Padrão | Efeito |
|---|---|---|
| `typing` | `true` | desligado envia instantaneamente, sem presença |
| `typingMsPerChar` | `45` | milissegundos por caractere da resposta |
| `typingMinMs` | `1500` | piso — respostas curtas não saem no mesmo segundo |
| `typingMaxMs` | `8000` | teto — resposta longa não deixa o cliente esperando |

A espera local roda **em paralelo** com a requisição de presença (a Evolution segura a presença pelo mesmo `delay` do lado dela; em série o cliente esperaria o dobro).

| Provider | Como |
|---|---|
| `evolution` | `POST /chat/sendPresence/{instance}` com `presence: 'composing'` |
| `meta` | `typing_indicator` na Cloud API — exige o id da mensagem recebida, guardado em `waMessageId` |

Presença é cosmética: se o provider falhar, a resposta sai igual e o motivo vai para o log.

### Coleta de leads

Os campos que a IA precisa coletar são definidos em **Comportamento da IA → Coleta e leads** e entram no **JSON schema da resposta** — não existe tag em texto para parsear com regex. Cada resposta traz:

```json
{ "reply": "...", "handoff": false, "handoff_reason": "",
  "lead": { "complete": true, "fields": { "nome": "João", "interesse": "plano anual", "melhor_horario": "quinta 19h" } } }
```

| Config | Padrão | Efeito |
|---|---|---|
| `leadCapture` | `true` | desligado remove o bloco `lead` do schema e a seção do prompt |
| `leadGoal` | — | o que a IA precisa conseguir na conversa |
| `leadFields` | 3 ativos | `{ on, key, label, desc, required }` por campo |
| `notifyOnLead` | `true` | avisa no WhatsApp quando o lead fecha |
| `notifyPhone` | — | número que recebe o aviso (com país e DDD) |

Regras que o backend garante, independente do que o modelo devolver:

- **`complete` é reavaliado no servidor.** Se algum campo obrigatório voltar vazio, o lead não fecha e o aviso não sai — a tela de sandbox mostra o que faltou.
- **Progresso parcial é gravado** a cada mensagem (`leadFilled` / `leadTotal` nos metadados da conversa).
- **O aviso sai uma vez por conversa** (`leadNotifiedAt`). Falha no envio não desfaz o lead: o motivo fica em `leadNotify`.
- **Chaves são normalizadas** (`Melhor horário` → `melhor_horario`); duplicadas e campos sem rótulo são descartados.

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/leads` | todos os leads, recentes primeiro (`?complete=true` filtra os fechados) |
| `GET` | `/api/leads/:phone` | o lead de uma conversa |

Ao fechar um lead o servidor também emite `lead:new` na sala da conta no Socket.IO.

---

## Painel de métricas

`GET /api/metrics[?days=14]` calcula em cima dos metadados das conversas e dos leads da conta — sem tabela de eventos própria e sem amostragem. A tela é a aba **Painel** (`pages/Metrics.jsx`).

| Bloco | Campos |
|---|---|
| `conversations` | `total`, `today`, `yesterday`, `unread`, `escalated`, `pausedByHuman`, `resolvedByAi`, `resolvedByAiPct` |
| `leads` | `closed`, `inProgress`, `today`, `conversionPct`, `avgFillPct`, `notified` |
| `series` | um item por dia (`{ day, conversations, leads }`), dias vazios incluídos |
| `recentLeads` | últimos 10 leads fechados, com os campos coletados |

Duas séries no gráfico — conversas e leads — em barras agrupadas no **mesmo eixo**: é a mesma unidade (contagem por dia). O par de cores passou pelas seis checagens de daltonismo e contraste nos temas claro e escuro.

**"Resolvidas pela IA"** conta conversas que nunca precisaram de humano nem foram assumidas por um — é o que os metadados permitem afirmar. Métricas que exigiriam histórico de eventos (tempo real de primeira resposta, tempo de resolução) não estão aqui.

> A tela **Equipe e filas** ainda usa `TEAM_DEMO` (dados fictícios) — não existe backend de equipe. As métricas reais são as do Painel.

---

## Usando seu próprio número (Evolution API)

**1. Suba a Evolution API** (Postgres e Redis próprios dela inclusos, mais o `hub-mongo`):

```bash
docker compose -f docker-compose.evolution.yml up -d
```

`AUTHENTICATION_API_KEY` no compose e `EVOLUTION_API_KEY` no `backend/.env` precisam ser **iguais**.

**2. Crie sua conta e pareie o número pelo próprio produto.** Abra o frontend, clique em **Criar conta** e leia o QR na tela de onboarding — é o caminho normal, e é ele que grava `onboardedAt` liberando o painel.

Pela API, se precisar (o token é o JWT devolvido por `/api/auth/login`):

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"voce@empresa.com.br","password":"suasenha"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# cria a instância da SUA conta e registra o webhook
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/instance

# pega o QR code (campo "qrcode" = data URI; cole no navegador)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/instance/qr

# confere a conexão — "open" = número pareado, e marca o onboarding como feito
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/instance
```

**3. Leia o QR** no celular: WhatsApp → **Aparelhos conectados → Conectar aparelho**.

Depois disso, mensagens recebidas no seu número caem em `POST /webhook`, são resolvidas para a sua conta pelo nome da instância e aparecem no seu painel; respostas saem pelo seu número.

### Endpoints da instância (só no provider `evolution`)

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/instance` | estado da conexão (`open` / `connecting` / `close`) — e conclui o onboarding |
| `POST` | `/api/instance` | cria a instância (idempotente) |
| `GET` | `/api/instance/qr` | QR code base64 + pairing code |
| `POST` | `/api/instance/webhook` | re-registra `EVOLUTION_WEBHOOK_URL` |
| `DELETE` | `/api/instance` | desconecta o número (logout) |

### Webhook: qual URL usar

A URL é resolvida **de dentro do container**, não do seu terminal:

| Cenário | `EVOLUTION_WEBHOOK_URL` |
|---|---|
| Evolution em Docker, backend no host (Windows/Mac) | `http://host.docker.internal:3001/webhook` |
| Evolution em Docker, backend no host (Linux) | `http://172.17.0.1:3001/webhook` |
| Ambos na mesma rede Docker | `http://nome-do-servico:3001/webhook` |
| Evolution remota / VPS | `https://SEU_DOMINIO/webhook` (ngrok em dev) |

> A Evolution v2 usa `POST /message/sendText/{instance}` com body `{ number, text }`. Se você rodar uma imagem v1, o body é `{ number, textMessage: { text } }` — ajuste em [evolution.js](backend/src/services/evolution.js).

---

## Usando o número oficial (WhatsApp Cloud API)

Coloque `WHATSAPP_PROVIDER=meta` no `.env`, reinicie e registre o webhook:

1. No painel Meta for Developers, vá em **WhatsApp → Configuration → Webhook**
2. URL do Callback: `https://SEU_DOMINIO/webhook`  
   (em desenvolvimento, use ngrok: `ngrok http 3001`)
3. Verify Token: o valor de `WHATSAPP_VERIFY_TOKEN` no `.env`
4. Assinar o campo **messages**

---

## Configuração do frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`. Sem sessão você cai na página do produto — **Criar conta** cadastra e leva direto para o passo de conectar o WhatsApp.

---

## Estrutura do projeto

```
whatsapp-hub/
├── docker-compose.evolution.yml  # Evolution API + Postgres + Redis + MongoDB do hub
├── backend/
│   └── src/
│       ├── index.js              # Entry point (Express + Socket.IO)
│       ├── routes/
│       │   ├── webhook.js        # POST /webhook — resolve a conta pela instância
│       │   ├── auth.js           # /api/auth — signup, login, me
│       │   ├── messages.js       # GET/POST /api/messages
│       │   ├── ai.js             # /api/ai — config + sandbox do agente
│       │   ├── leads.js          # /api/leads — leads coletados pela IA
│       │   ├── metrics.js        # /api/metrics — painel
│       │   └── instance.js       # /api/instance — QR, estado, onboarding
│       ├── services/
│       │   ├── mongo.js          # Conexão, coleções e índices da base única
│       │   ├── store.js          # Conversas/mensagens/leads — sempre filtrados por accountId
│       │   ├── accounts.js       # Contas, senha (scrypt), alvo da instância
│       │   ├── tokens.js         # JWT HS256 (assina/valida a sessão)
│       │   ├── socket.js         # Broadcast por sala de conta
│       │   ├── provider.js       # Escolhe o provider (evolution | meta)
│       │   ├── evolution.js      # Evolution API v2 (envio + presença + instância)
│       │   ├── whatsapp.js       # WhatsApp Cloud API (envio + presença)
│       │   ├── ai.js             # System prompt + schema + chamada ao Claude
│       │   ├── aiConfig.js       # Configuração de comportamento (por conta)
│       │   ├── leads.js          # Grava o lead e avisa o responsável
│       │   ├── metrics.js        # Cálculo das métricas da conta
│       │   └── autoReply.js      # Resposta automática + digitação + handoff
│       └── middleware/
│           └── auth.js           # JWT + gate de onboarding
└── frontend/
    └── src/
        ├── App.jsx               # Gate: landing/login → onboarding → painel
        ├── pages/
        │   ├── Landing.jsx       # Página pública do produto
        │   ├── Signup.jsx        # Cadastro
        │   ├── Login.jsx         # E-mail + senha
        │   ├── Onboarding.jsx    # Conectar WhatsApp (bloqueante)
        │   ├── Dashboard.jsx     # Layout principal
        │   ├── Metrics.jsx       # Painel de métricas
        │   ├── Inbox.jsx         # Conversas
        │   └── AiSettings.jsx    # Comportamento da IA
        ├── components/
        │   ├── AuthShell.jsx        # Moldura de login/cadastro
        │   ├── ConnectPanel.jsx     # QR + pairing code (modal e onboarding)
        │   ├── ConversationList.jsx # Sidebar de conversas
        │   └── ChatWindow.jsx       # Janela de chat
        └── hooks/
            ├── useAuth.js        # Sessão, cadastro, authFetch
            ├── useInstance.js    # Estado da conexão + QR
            └── useSocket.js      # Cliente Socket.IO (um por token)
```

---

## Fluxo de uma mensagem

```
Usuário WhatsApp
  → POST /webhook (Evolution API ou Meta)
    → extractInboundMessage()  # implementação do provider ativo
      → resolveAccount()       # instância do payload → conta dona
      → formatMessage()  →  "5511999990000: Olá!"
        → saveMessage() → messages + conversations, marcados com accountId
          → broadcastMessage() via Socket.IO
            → ChatWindow exibe a bolha
              → maybeAutoReply()             # se a IA estiver ligada
                → generateReply()            # Claude + config + schema com os campos de lead
                  → sendPresence()           # "digitando…" + espera proporcional
                    → sendWhatsAppMessage()  # resposta sai pelo provider
                      → saveMessage() + broadcastMessage()
                        → handleLead()       # grava campos; lead fechado → avisa no WhatsApp
```

---

## Formato padrão das mensagens

Todas as mensagens seguem o padrão `Label: texto`:

- **Inbound:** `5511999990000: Olá, tudo bem?`
- **Outbound (operador):** `Operador: Olá! Como posso ajudar?`
- **Outbound (IA):** `Nina: Olá! Como posso ajudar?` — assina com `agentName` e traz `author: 'ai'`

O campo `formatted` está disponível em cada objeto de mensagem para logging/integração.

---

## O que ainda não existe

- **Vários usuários por conta.** Uma conta = um login. "Equipe e filas" é tela de demonstração; convidar pessoa exige um modelo de usuários dentro da conta.
- **Revogação de sessão.** O JWT é sem estado: trocar a senha não invalida tokens já emitidos. Precisa de uma coleção de `jti` revogados.
- **Recuperação de senha.** Não há fluxo de "esqueci minha senha" (depende de envio de e-mail).
- **Rate limit no login.** Nada limita tentativas de senha por IP ou por conta.
- **Mídia.** Só texto: implemente `message.type === 'image'` no webhook e a API de mídia do provider.
- **Filas.** Para escala, mova o processamento do webhook para BullMQ — hoje ele roda no próprio request.
- **Deploy.** Docker Compose com Node + Nginx. Passando de ~30–50 contas, um segundo container Evolution e o `evolutionUrl` das contas novas apontando para ele.
