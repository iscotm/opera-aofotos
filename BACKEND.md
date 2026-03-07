# BACKEND — Operação SaaS
## Antigravity + Supabase (via MCP)

---

## 1. SUPABASE — SQL (rode no editor do Supabase)

```sql
-- ─────────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────────
create table employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  salary      numeric(10,2) default 0,
  username    text unique not null,
  password    text not null,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- SALES (aprovadas)
-- ─────────────────────────────────────────────
create table sales (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid references employees(id) on delete cascade,
  employee_name  text,
  value          numeric(10,2) not null,
  description    text,
  date           date not null,
  approved       boolean default true,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────
-- PENDING SALES (aguardando aprovação)
-- ─────────────────────────────────────────────
create table pending_sales (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid references employees(id) on delete cascade,
  employee_name  text,
  value          numeric(10,2) not null,
  description    text,
  date           date not null,
  approved       boolean default false,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────
-- TRÁFEGO POR FUNCIONÁRIO
-- ─────────────────────────────────────────────
create table emp_traffic (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid references employees(id) on delete cascade,
  value           numeric(10,2) not null,
  value_with_tax  numeric(10,2) not null,
  date            date not null,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
-- DESPESAS GERAIS
-- ─────────────────────────────────────────────
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  value        numeric(10,2) not null,
  raw_value    numeric(10,2),
  traffic      boolean default false,
  date         date not null,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- CATEGORIAS
-- ─────────────────────────────────────────────
create table categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  color text default '#f5a623'
);

-- ─────────────────────────────────────────────
-- PROMPTS
-- ─────────────────────────────────────────────
create table prompts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  prompt_text  text,
  image_url    text,
  category_id  uuid references categories(id) on delete set null,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- SEED: admin padrão (não fica na tabela employees)
-- O admin é validado por variável de ambiente no back
-- ─────────────────────────────────────────────
```

---

## 2. VARIÁVEIS DE AMBIENTE (Antigravity)

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...          # service_role key (não a anon)
JWT_SECRET=uma-string-longa-segura   # ex: openssl rand -base64 48
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123              # troque em produção
JWT_EXPIRES_IN=7d
```

---

## 3. ENDPOINTS

### Convenções
- Todas as rotas exceto `POST /auth/login` exigem `Authorization: Bearer <token>`
- Respostas de erro: `{ "message": "..." }`
- IDs: UUID v4
- Datas: string `"YYYY-MM-DD"`
- snake_case no banco → camelCase no JSON de resposta

---

### 3.1 AUTH

#### `POST /auth/login`
```json
// Body
{ "username": "admin", "password": "admin123" }

// Response 200 — dono
{
  "token": "eyJ...",
  "role": "owner",
  "employee": null
}

// Response 200 — funcionário
{
  "token": "eyJ...",
  "role": "employee",
  "employee": {
    "id": "uuid",
    "name": "Maria",
    "username": "maria",
    "role": "Closer",
    "salary": 3000
  }
}

// Response 401
{ "message": "Usuário ou senha incorretos" }
```

**Lógica:**
1. Se `username == env.ADMIN_USERNAME && password == env.ADMIN_PASSWORD` → role `owner`
2. Senão: `select * from employees where username = $1` e comparar senha (plain ou bcrypt)
3. Assinar JWT com `{ sub: id_ou_"admin", role, username }`

---

#### `GET /auth/me`
Retorna o usuário logado com base no token.

```json
// Response 200 — dono
{ "role": "owner", "employee": null }

// Response 200 — funcionário
{
  "role": "employee",
  "employee": { "id": "uuid", "name": "Maria", ... }
}
```

---

### 3.2 STATE

#### `GET /state`
Snapshot completo — usado pelo front na inicialização.

```json
// Response 200
{
  "employees":   [ ...employees sem campo password ],
  "sales":       [ ...sales ],
  "pendingSales":[ ...pending_sales ],
  "empTraffic":  [ ...emp_traffic   ],
  "expenses":    [ ...expenses      ],
  "prompts":     [ ...prompts       ],
  "categories":  [ ...categories    ]
}
```

**Mapeamento de campos (snake → camel):**
```
employee_id    → employeeId
employee_name  → employeeName
value_with_tax → valueWithTax
raw_value      → rawValue
prompt_text    → promptText
image_url      → imageUrl
category_id    → categoryId
created_at     → createdAt
```

**Restrição por role:**
- `owner` → retorna tudo
- `employee` → retorna:
  - `employees: []` (vazio ou só ele)
  - `sales` e `pendingSales` filtrados por `employee_id = sub do token`
  - `prompts` e `categories` completos
  - `empTraffic`, `expenses`: vazios (não precisa)

---

### 3.3 EMPLOYEES

| Método | Rota | Ação |
|--------|------|------|
| GET    | `/employees`    | Lista todos |
| POST   | `/employees`    | Cria |
| PUT    | `/employees/:id`| Atualiza |
| DELETE | `/employees/:id`| Exclui (cascade) |

**GET /employees — Response 200:**
```json
[{
  "id": "uuid",
  "name": "Maria Silva",
  "role": "Closer",
  "salary": 3000,
  "username": "maria"
}]
```
> Nunca retornar `password`.

**POST /employees — Body:**
```json
{
  "name": "Maria Silva",
  "role": "Closer",
  "salary": 3000,
  "username": "maria",
  "password": "senha123"
}
```
Response 201: funcionário criado (sem password).

**PUT /employees/:id — Body:** (campos que mudam)
```json
{
  "name": "Maria Silva",
  "salary": 3500,
  "password": ""
}
```
> Se `password === ""` → não atualizar o campo senha.

Response 200: funcionário atualizado.

**DELETE /employees/:id**
- Deleta da tabela `employees`
- O `on delete cascade` já remove: `sales`, `pending_sales`, `emp_traffic`

Response 204.

---

### 3.4 SALES

| Método | Rota | Ação |
|--------|------|------|
| GET    | `/sales`    | Lista aprovadas |
| POST   | `/sales`    | Cria diretamente (pelo dono) |
| DELETE | `/sales/:id`| Remove |

**GET — Response 200:**
```json
[{
  "id": "uuid",
  "employeeId": "uuid",
  "employeeName": "Maria",
  "value": 250,
  "description": "Venda X",
  "date": "2026-03-07",
  "approved": true
}]
```

**POST — Body:**
```json
{
  "employeeId": "uuid",
  "value": 250,
  "description": "Venda X",
  "date": "2026-03-07"
}
```
> Buscar `employeeName` pelo `employeeId` no banco antes de inserir.

Response 201: venda criada.

---

### 3.5 PENDING SALES

| Método | Rota | Ação |
|--------|------|------|
| GET    | `/sales/pending`                    | Lista pendentes |
| POST   | `/sales/pending`                    | Funcionário envia |
| POST   | `/sales/pending/:id/approve`        | Aprova uma |
| POST   | `/sales/pending/approve-all`        | Aprova todas |
| DELETE | `/sales/pending/:id`                | Rejeita |

**POST /sales/pending — Body:**
```json
{
  "employeeId": "uuid",
  "employeeName": "Maria",
  "value": 300,
  "description": "Pacote premium",
  "date": "2026-03-07"
}
```

**POST /sales/pending/:id/approve — Lógica:**
1. Busca a pendente pelo `id`
2. Insere em `sales` com `approved: true`
3. Deleta de `pending_sales`
4. Response 200: `{ "approved": { ...sale } }`

**POST /sales/pending/approve-all — Lógica:**
1. Busca todas as pendentes
2. Insere todas em `sales`
3. Deleta todas de `pending_sales`
4. Response 200: `{ "approved": N }`

---

### 3.6 TRAFFIC

| Método | Rota | Ação |
|--------|------|------|
| GET    | `/traffic`    | Lista todos |
| POST   | `/traffic`    | Cria |
| DELETE | `/traffic/:id`| Remove |

**POST — Body:**
```json
{
  "employeeId": "uuid",
  "value": 130,
  "valueWithTax": 146.90,
  "date": "2026-03-07"
}
```
> `valueWithTax = value * 1.13` — o front já calcula e envia.

---

### 3.7 EXPENSES

| Método | Rota | Ação |
|--------|------|------|
| GET    | `/expenses`    | Lista todas |
| POST   | `/expenses`    | Cria |
| DELETE | `/expenses/:id`| Remove |

**POST — Body:**
```json
{
  "description": "Google Ads",
  "value": 565,
  "rawValue": 500,
  "traffic": true,
  "date": "2026-03-07"
}
```
> `value` é o total final. `rawValue` é antes do imposto (só quando `traffic: true`).

---

### 3.8 PROMPTS

| Método | Rota | Ação |
|--------|------|------|
| GET    | `/prompts`    | Lista todos |
| POST   | `/prompts`    | Cria |
| PUT    | `/prompts/:id`| Atualiza |
| DELETE | `/prompts/:id`| Remove |

**POST — Body:**
```json
{
  "title": "Foto de produto",
  "promptText": "photorealistic product shot on white...",
  "imageUrl": "https://...",
  "categoryId": "uuid-ou-null"
}
```

---

### 3.9 CATEGORIES

| Método | Rota | Ação |
|--------|------|------|
| GET    | `/categories`    | Lista todas |
| POST   | `/categories`    | Cria |
| DELETE | `/categories/:id`| Remove |

**POST — Body:**
```json
{ "name": "Produtos", "color": "#f5a623" }
```

**DELETE /categories/:id — Lógica:**
- O `on delete set null` do Supabase já cuida: prompts com essa categoria ficam com `categoryId = null`

---

## 4. MIDDLEWARE JWT

```js
// Middleware a aplicar em todas as rotas exceto POST /auth/login
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Token ausente" });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = payload; // { sub, role, username }
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}
```

---

## 5. CORS

```js
cors({
  origin: [
    "http://localhost:5173",
    "https://SEU-DOMINIO-FRONT.com"
  ],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true
})
```

---

## 6. CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar tabelas no Supabase (SQL da seção 1)
- [ ] Configurar variáveis de ambiente no Antigravity
- [ ] Implementar `POST /auth/login` com JWT
- [ ] Implementar `GET /auth/me`
- [ ] Implementar `GET /state`
- [ ] Implementar CRUD de `/employees`
- [ ] Implementar CRUD de `/sales`
- [ ] Implementar `/sales/pending` + `/approve` + `/approve-all`
- [ ] Implementar CRUD de `/traffic`
- [ ] Implementar CRUD de `/expenses`
- [ ] Implementar CRUD de `/prompts`
- [ ] Implementar CRUD de `/categories`
- [ ] Aplicar middleware JWT em todas as rotas autenticadas
- [ ] Configurar CORS com a URL do front
- [ ] Testar com o front em modo dev (`npm run dev`)
