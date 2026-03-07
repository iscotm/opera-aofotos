# Operação SaaS — Frontend

Sistema de gestão de vendas de fotos geradas com IA.

## Rodando localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variável de ambiente
cp .env.example .env
# edite .env e coloque a URL do backend

# 3. Rodar em dev
npm run dev
# acesse http://localhost:5173

# 4. Build para produção
npm run build
# pasta dist/ pronta para deploy
```

## Estrutura

```
operacao-front/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx       # entry point React
│   └── App.jsx        # aplicação completa (single-file)
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── BACKEND.md         # contrato completo da API
```

## Login padrão (enquanto backend não estiver pronto)

| Usuário | Senha | Acesso |
|---------|-------|--------|
| admin | admin123 | Painel completo |
| (cadastrado pelo dono) | (definido pelo dono) | Área do funcionário |

## Backend

Veja `BACKEND.md` para o contrato completo da API, SQL do Supabase, variáveis de ambiente e checklist de implementação.
