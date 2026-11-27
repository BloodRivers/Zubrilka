# Зубрилка

PWA для учёбы: конспекты, тесты, повторение и тренажёры ЕГЭ. Рассчитана на небольшую группу (около четырёх человек), но работает и для одного пользователя: есть гостевой режим и публичная библиотека.

## О приложении

- **Предметы и конспекты.** Конспекты по предметам, импорт текста, PDF, Word (.docx) и фото; OCR/вычитка и структурирование через ИИ. В конспекте — Markdown, формулы (KaTeX), таблицы, аккордеоны, цветные бейджи и вкладки «Конспект» / «Пересказ» / «Картинки».
- **Тесты.** Генерация тестов из конспекта, режимы «выбор», «квизлет», «сопоставление» и письменные ответы с проверкой ИИ. Результаты, разбор ошибок, повтор слабых тем.
- **Повторение.** «Повторить сегодня» по интервальному расписанию, серия дней подряд, прогресс за 7 дней, бейджи, лидерборд и профили пользователей.
- **Библиотека.** Публичные конспекты и тесты с нечётким поиском, фильтрами и карточками авторов.
- **ЕГЭ.** Тренажёры русского языка (ударения, паронимы, части речи, корни, ПРЕ-/ПРИ-, Н/НН, средства выразительности и др.), информатика (таблицы истинности + редактор Python), устная часть английского (чтение вслух и диалог: запись с микрофона, расшифровка Whisper, оценка по критериям экзамена).
- **Учебники.** PDF добавляется в предмет, листается в приложении, страницу можно привязать к конспекту. Файл хранится только на устройстве (IndexedDB), в Firestore — только список учебников.
- **Прочее.** Темы интерфейса, звуки, баннер обновления, Web Push, импорт/экспорт данных, согласие с документами при первом входе.

Вход: Email/Пароль, Google или анонимно (гость). Гости не могут создавать конспекты и тесты.

## Стек

- Клиент: React 19 + Vite, react-router, Firebase (Auth, Firestore, Cloud Messaging), pdf.js, KaTeX, lucide-react.
- ИИ: [Polza AI](https://polza.ai) напрямую из браузера (BYOK, свой ключ). Лимит — 20 запросов на пользователя в день, счётчик хранится в Firestore.
- Бэкенд: необязательный Express-сервер (Polza через `POLZA_API_KEY`), для основного сценария не нужен.
- Хостинг: Firebase Hosting, PWA (service worker регистрируется только в production).

## Структура

```
client/   React + Vite PWA; src/screens — экраны, src/data — банки тренажёров, src/api — Firestore и Polza
server/   опциональный Express API (/api/*)
scripts/  notify-update.mjs (уведомление о релизе), tts-task3.mjs
firestore.rules, firestore.indexes.json, firebase.json
```

## Запуск

### 1. Firebase (plan Spark)

- Создать проект в Firebase Console.
- Authentication → включить **Email/Пароль**, **Google** и **Анонимный** (гостевой режим).
- Firestore Database → создать БД, затем залить `firestore.rules` и `firestore.indexes.json`.
- Project settings → Web app → скопировать конфиг в `client/.env` (файл `.example` в репозитории нет):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...   # опционально, для Web Push
```

### 2. Клиент

```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

Команды из корня проекта: `npm run dev`, `npm run build`, `npm run lint`, `npm test` (тесты в `client/test/`).

### 3. Polza AI

1. Получить ключ на [polza.ai/dashboard](https://polza.ai/dashboard).
2. В приложении: **Настройки → Модель ИИ** — вставить ключ.
3. Ключ и дневной лимит синхронизируются между устройством и профилем Firestore; в бандл ключ не попадает.

### 4. Опциональный сервер

```bash
cd server
npm install
# в server/.env: POLZA_API_KEY=..., при необходимости FIREBASE_SERVICE_ACCOUNT=... и POLZA_MODEL=...
npm run dev      # :4000
```

Эндпоинты: `POST /api/analyze-note`, `/api/generate-test`, `/api/grade-written`, `/api/analyze-results`; все требуют Firebase ID-токен в `Authorization: Bearer`. Основные ИИ-вызовы при этом идут из браузера (`client/src/api/ai.js`, `backend.js`).

## Деплой и обновления

```bash
npm run build        # client/dist
firebase deploy      # hosted по firebase.json (SPA-rewrite на index.html)
```

PWA: `client/public/manifest.json` + `sw.js`, иконка `favicon.svg`. После деплоя:

1. Баннер «Доступна новая версия» появляется при обновлении документа `app/release` (waiting service worker).
2. Web Push: задать `VITE_FIREBASE_VAPID_KEY`, включить уведомления в настройках, затем `npm run notify-update` (нужны `serviceAccount.json` в корне и `firebase-admin`).

## Firestore

- `users/{uid}` — профиль (`name`, `photo_url`, `polza_key`, `ai_usage`, `fcm_token`, `push_enabled`).
- `leaderboard/{uid}` — имя, фото и результаты; пишет только владелец строки.
- `subjects` — `{owner_id, name, icon, color}`.
- `textbooks` — `{owner_id, subject_id, title}`; сам PDF — в IndexedDB.
- `notes` — `{owner_id, shared_with[], subject_id, title, text, retelling, summary[], images[], public}`.
- `tests` — `{owner_id, shared_with[], note_ids[], type, questions[], modes[], public}`.
- `test_results` — `{user_id, test_id, score, total, weak_topics[], detail[]}`.
- `oral_results`, `oral_progress` — результаты и прогресс устной части ЕГЭ.
- `app/release` — маркер версии для баннера (пишет только Admin SDK).

Публичные конспекты и тесты (`public: true`) читаются из библиотеки без входа в аккаунт; остальные данные доступны только владельцу.
