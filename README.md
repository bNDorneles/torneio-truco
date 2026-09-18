# Torneio de Truco

App web para gerenciar torneio de truco: jogadores, sorteio de duplas, grupos, placares ao vivo e mata-mata.

Publicação: **GitHub** (código) + **Vercel** (site) + **Firebase Firestore** (dados).

Repositório: https://github.com/bNDorneles/torneio-truco

## Rodar local

No PowerShell, se `npm` for bloqueado, use `npm.cmd`:

```bash
npm install
npm run dev
```

Sem Firebase, o app usa **localStorage** (só no mesmo navegador).

## Publicar (GitHub + Vercel)

1. Código já está neste repositório.
2. Em [vercel.com](https://vercel.com) → **Add New** → **Project** → importe `bNDorneles/torneio-truco`.
3. Preset **Vite**, build `npm run build`, output `dist`.
4. Em **Settings → Environment Variables**, cadastre as `VITE_FIREBASE_*` (veja abaixo).
5. Faça um **Redeploy** depois de salvar as variáveis (o Vite só lê isso no build).

O site fica em `https://<projeto>.vercel.app`. Rotas como `/t/slug` e `/t/slug/admin` funcionam por causa do `vercel.json`.

## Configurar Firebase (placar para quem está fora)

Passo a passo completo: [docs/SETUP_FIREBASE.md](docs/SETUP_FIREBASE.md).

Resumo:

1. Projeto Firebase `truco-2dc5a` + Firestore
2. Local: `.env` com as chaves `VITE_FIREBASE_*`
3. Regras do Firestore publicadas no console

Variáveis (`VITE_` no `.env` local e no painel do Vercel):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Fluxo do organizador

1. Criar torneio (nome + senha)
2. Cadastrar jogadores (quantidade par)
3. Sortear duplas (uma vez)
4. Sortear grupos (3–4 duplas) e gerar todos vs todos
5. Lançar o placar de cada partida (select a partir de 0)
6. Gerar mata-mata (1º×2º cruzado + modo manual)
7. Compartilhar `/t/seu-slug` (público) ou `/t/seu-slug/tv` (projetor)

## Desempates

Vitórias → saldo de sets → confronto direto → saldo de rounds.

## Backup

Em Config: exportar / importar JSON do torneio.
