# Configurar Firebase — passo a passo

O app funciona **sem Firebase** (salva no navegador). Para quem está fora ver o placar no site do Vercel, configure o Firestore.

O **site** é publicado no Vercel. O Firebase entra só como **banco**.

## 1. Criar projeto

1. Acesse https://console.firebase.google.com/
2. **Add project** → nome (ex. `torneio-truco`)
3. Pode desligar Google Analytics

## 2. App Web

1. No projeto → ícone **Web** (`</>`)
2. Apelido: `torneio-web`
3. Copie o objeto `firebaseConfig`

## 3. Firestore

1. Build → **Firestore Database** → Create database
2. Escolha região (ex. `southamerica-east1`)
3. Comece em **production mode**
4. Publique as regras:

```bash
# edite .firebaserc — troque SEU_PROJECT_ID pelo id real
npx firebase login
npm run deploy:rules
```

Ou cole o conteúdo de `firestore.rules` no console (Firestore → Rules).

## 4. Variáveis locais

```bash
copy .env.example .env
```

| Campo no Firebase     | Variável                         |
|-----------------------|----------------------------------|
| apiKey                | VITE_FIREBASE_API_KEY            |
| authDomain            | VITE_FIREBASE_AUTH_DOMAIN        |
| projectId             | VITE_FIREBASE_PROJECT_ID         |
| storageBucket         | VITE_FIREBASE_STORAGE_BUCKET     |
| messagingSenderId     | VITE_FIREBASE_MESSAGING_SENDER_ID|
| appId                 | VITE_FIREBASE_APP_ID             |

Reinicie `npm run dev`.

## 5. Mesmas variáveis no Vercel

No projeto Vercel → **Settings → Environment Variables**, cadastre as seis `VITE_FIREBASE_*` para Production (e Preview, se quiser).

Depois: **Deployments → … → Redeploy** (sem cache, se possível). Sem isso o site publicado continua em modo localStorage.

No Firebase, se o Console pedir, libere o domínio `*.vercel.app` (Authentication → Settings → Authorized domains, ou restrições da API key).

## Segurança (plano Spark)

As rules atuais permitem leitura e escrita nos documentos de torneio (adequado para torneio entre amigos). A senha do organizador é validada no app (hash SHA-256).
