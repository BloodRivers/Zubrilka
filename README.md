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
cp .env.example .env   # заполнить VITE_FIREBASE_* (остальное можно не трогать)
npm run dev
```

Сразу из коробки работает **локальный режим** (`VITE_USE_MOCK=1`):
структура конспекта, тесты и оценка генерируются в браузере. Это
фолбэк для разработки; в проде включаем настоящий LLM.

### 3. Polza AI (Claude / OpenAI)

LLM вызывается из браузера через [Polza AI](https://polza.ai) (BYOK).
Доступны только Claude и OpenAI — без Gemini/Google.

1. Ключ: [polza.ai/dashboard](https://polza.ai/dashboard).
2. В `client/.env`: `VITE_USE_MOCK=0`.
3. В приложении: **Настройки → Модель ИИ** — вставить ключ.
   По умолчанию Claude Sonnet 4.5 (нормальный OCR). Дешёвые mini — только если ок с потерями.
4. Собрать и задеплоить статику: `npm run build`, затем загрузить `client/dist`.

Ключ хранится только на устройстве (localStorage), в бандл не попадает.

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
