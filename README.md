# Забубрилка

PWA для учёбы четырёх человек: конспекты, тесты, повторение.

## Структура

```
client/   React + Vite PWA (react-router, firebase, Polza AI из браузера)
server/   опциональный бэкенд (Polza через POLZA_API_KEY)
firestore.rules
```

## Настройка

### 1. Firebase (план Spark)

- `console.firebase.google.com` → создать проект.
- Authentication → включить **Email/Пароль** и **Google**.
- Firestore Database → создать (test mode сначала, потом залить `firestore.rules`).
- Project settings → Web app → скопировать config в переменные.

### 2. Client

```bash
cd client
npm install
cp .env.example .env   # заполнить VITE_FIREBASE_*
npm run dev
```

### 3. Polza AI

LLM вызывается из браузера через [Polza AI](https://polza.ai) (BYOK).

1. Ключ: [polza.ai/dashboard](https://polza.ai/dashboard).
2. В приложении: **Настройки → Модель ИИ** — вставить ключ.
3. Собрать и задеплоить: `npm run build`, затем Firebase Hosting (`client/dist`).

Ключ хранится на устройстве и в профиле Firestore, в бандл не попадает.

### 4. Запуск

```bash
npm run dev   # client на :5173
```

## Эндпоинты

LLM-вызовы идут напрямую из браузера в Polza AI (см. `client/src/api/ai.js`):
распознавание конспекта, генерация тестов, оценка. Опциональный сервер —
`server/lib/polza.js`.

## PWA

`client/public/manifest.json` + `sw.js`. Service worker регистрируется только в
production-сборке. Иконки: `favicon.svg` (можно заменить на PNG в manifest).

## Схема Firestore

- `users/{uid}` — профиль
- `subjects` — `{owner_id, name}` (виден только владельцу)
- `notes` — `{owner_id, shared_with[], subject_id, title, text, topics[], plan[]}`
- `tests` — `{owner_id, shared_with[], note_ids[], type, questions[]}`
- `test_results` — `{user_id, test_id, score, total, weak_topics[], detail[]}`
