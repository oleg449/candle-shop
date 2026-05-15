from __future__ import annotations

# Standard imports
import json
import requests
import logging
import os
import re
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Telegram imports
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ChatPermissions
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

async def send_operator_request_card(context: ContextTypes.DEFAULT_TYPE, user_obj, last_text: str, source: dict, reason: str = ""):
    """Отправляет карточку-заявку оператору (в ADMIN_CHAT_ID или OPERATOR_ID) и возвращает True/False по успеху."""
    try:
        user_id = user_obj.id
        user_full_name = user_obj.full_name
        username = user_obj.username
        # Текст карточки
        operator_message = (
            "🆘 НОВЫЙ ЗАПРОС НА КОНСУЛЬТАЦИЮ\n\n"
            f"👤 Пользователь: {user_full_name}\n"
            f"🆔 ID: {user_id}\n"
            f"📝 Username: @{username or 'не указан'}\n"
            f"💬 Где: {source.get('chat_type', 'unknown')} | chat_id: {source.get('chat_id')}"
            + (f" | thread_id: {source.get('thread_id')}" if source.get('thread_id') else "") + "\n"
        )
        if reason:
            operator_message += f"❓ **Причина:** {reason}\n"
        operator_message += (
            "\n💬 Последнее сообщение:\n"
            f"{last_text}\n\n"
            "🔄 Для ответа пользователю просто напишите сообщение в этот чат."
        )

        # Кнопки операции
        keyboard = [
            [
                InlineKeyboardButton("✅ Принять заявку", callback_data=f"accept_request_{user_id}"),
                InlineKeyboardButton("❌ Отклонить", callback_data=f"decline_request_{user_id}")
            ],
            [InlineKeyboardButton("📋 Завершить чат", callback_data=f"end_chat_{user_id}")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await context.bot.send_message(
            chat_id=ADMIN_CHAT_ID if ADMIN_CHAT_ID else OPERATOR_ID,
            text=operator_message,
            reply_markup=reply_markup
        )
        return True
    except Exception as e:
        logger.error(f"send_operator_request_card error: {e}")
        return False

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# 🔹 Загружаем товары из файла products.json
try:
    with open("products.json", "r", encoding="utf-8") as f:
        products = json.load(f)
    logger.info(f"✅ Загружено {len(products)} товаров из products.json")
except FileNotFoundError:
    logger.warning("⚠️ Файл products.json не найден. Создаем пустой список товаров.")
    products = []
except json.JSONDecodeError as e:
    logger.error(f"❌ Ошибка при чтении products.json: {e}")
    products = []

# 🔹 Загружаем мастер-классы из файла masterclasses.json
try:
    with open("masterclasses.json", "r", encoding="utf-8") as f:
        masterclasses = json.load(f)
    logger.info(f"✅ Загружено {len(masterclasses)} мастер-классов из masterclasses.json")
except FileNotFoundError:
    logger.warning("⚠️ Файл masterclasses.json не найден. Создаем пустой список мастер-классов.")
    masterclasses = []
except json.JSONDecodeError as e:
    logger.error(f"❌ Ошибка при чтении masterclasses.json: {e}")
    masterclasses = []

# 🔹 Загружаем наборы из файла sets.json
try:
    with open("sets.json", "r", encoding="utf-8") as f:
        sets = json.load(f)
    logger.info(f"✅ Загружено {len(sets)} наборов из sets.json")
except FileNotFoundError:
    logger.warning("⚠️ Файл sets.json не найден. Создаем пустой список наборов.")
    sets = []
except json.JSONDecodeError as e:
    logger.error(f"❌ Ошибка при чтении sets.json: {e}")
    sets = []

# 🔹 Gemini API настройки
# Используем значение из окружения при наличии, иначе оставляем текущее
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAfMgaPucyyH_0nuOpb-yFf3ZZ2DB9AGpo")  # потом заменишь
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# 🔹 Локальные изображения для постов
# Путь к папке с вашими картинками свечей
LOCAL_IMAGES_DIR = r"C:\Users\supeg\Desktop\Свечи сайт\images"
# Файл для хранения индекса, чтобы после перезапуска продолжать с нового изображения
LOCAL_IMAGES_INDEX_FILE = "image_index.txt"
# Индекс по категориям, чтобы равномерно перебирать картинки внутри тем
LOCAL_IMAGES_INDEX_PER_CAT_PREFIX = "image_index_cat_"

# 🔹 Тестовый источник изображений (без API ключей) — используется как резервный
TEST_IMAGES_ENABLED = True
TEST_IMAGE_WIDTH = 1280
TEST_IMAGE_HEIGHT = 720

def get_test_image_url(seed_text: str = "candles cozy") -> str:
    """Возвращает URL случайного изображения для теста (picsum.photos) без API-ключей.
    Используем seed по тексту, чтобы картинки выглядели стабильнее между перезапусками.
    """
    try:
        seed = str(abs(hash(seed_text)) % 10_000_000)
    except Exception:
        seed = "artlight"
    return f"https://picsum.photos/seed/{seed}/{TEST_IMAGE_WIDTH}/{TEST_IMAGE_HEIGHT}"

def _list_local_images() -> list[str]:
    import os
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    if not os.path.isdir(LOCAL_IMAGES_DIR):
        return []
    files = []
    for name in sorted(os.listdir(LOCAL_IMAGES_DIR)):
        p = os.path.join(LOCAL_IMAGES_DIR, name)
        if os.path.isfile(p) and os.path.splitext(name.lower())[1] in exts:
            files.append(p)
    return files

def _load_image_index(max_len: int) -> int:
    import os
    try:
        if not os.path.exists(LOCAL_IMAGES_INDEX_FILE):
            return 0
        with open(LOCAL_IMAGES_INDEX_FILE, "r", encoding="utf-8") as f:
            idx = int((f.read() or "0").strip())
            if idx < 0:
                idx = 0
            if max_len > 0:
                idx = idx % max_len
            return idx
    except Exception:
        return 0

def _save_image_index(idx: int) -> None:
    try:
        with open(LOCAL_IMAGES_INDEX_FILE, "w", encoding="utf-8") as f:
            f.write(str(idx))
    except Exception:
        pass

def get_next_local_image_path() -> str | None:
    files = _list_local_images()
    if not files:
        return None
    idx = _load_image_index(len(files))
    path = files[idx]
    next_idx = (idx + 1) % len(files)
    _save_image_index(next_idx)
    return path

def _sanitize_poll(question: str, options: list[str]) -> tuple[str, list[str]]:
    """Очистка вопроса и вариантов: убираем эмодзи/нумерацию, дубликаты, длины, пустые строки.
    Возвращает (question, options)."""
    try:
        import re
        def strip_emojis(s: str) -> str:
            # Удаляем большинство emoji и пиктограмм
            return re.sub(r"[\U0001F300-\U0001FAFF\U00002700-\U000027BF]", "", s)
        def strip_numbering(s: str) -> str:
            return re.sub(r"^\s*\d+[\)\].\-\s]+", "", s)
        def norm(s: str) -> str:
            s = strip_emojis(s)
            s = strip_numbering(s)
            s = s.replace("\n", " ")
            s = re.sub(r"\s+", " ", s)
            return s.strip()
        q = norm(question)
        # Ограничения Telegram: вопрос до ~300, опции до 1–100 символов
        q = q[:300]
        cleaned = []
        seen = set()
        for o in options:
            x = norm(o)[:100]
            if not x:
                continue
            if x.lower() in seen:
                continue
            seen.add(x.lower())
            cleaned.append(x)
        # Оставим 2–10
        if len(cleaned) > 10:
            cleaned = cleaned[:10]
        return q, cleaned
    except Exception:
        # В случае сбоя вернём оригиналы (верхний слой проверит длины)
        return question, options
    

def generate_ai_instagram_promo_text() -> str | None:
    """Генерирует короткое промо-сообщение про Instagram магазина (укр.), включает ссылку."""
    sys_prompt = (
        "Ти — SMM-менеджер Art Light. Створи коротке (2–4 рядки) запрошення підписатися на наш Instagram, "
        "у дружньому тоні, без хештегів, з доречними емодзі, і обов'язково включи посилання в кінці."
    )
    user_prompt = f"Посилання на Instagram: {INSTAGRAM_URL}. Поверни тільки текст."
    data = {"contents": [{"parts": [{"text": sys_prompt + "\n\n" + user_prompt}]}]}
    res = _gemini_request(data)
    if not res:
        return None
    try:
        text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
        if INSTAGRAM_URL not in text:
            text += f"\n\n{INSTAGRAM_URL}"
        return text
    except Exception as e:
        logging.error(f"parse ai instagram promo failed: {e}")
    return None

def generate_ai_review_text() -> str | None:
    """Генерує позитивний 'відгук дня' українською на 3–5 рядків, без ПІД та посилань."""
    sys_prompt = (
        "Ти — задоволений покупець магазину свічок Art Light. Створи щирий позитивний відгук (3–5 рядків) українською. "
        "Не використовуй особисті дані, телефони, посилання чи згадки конкурентів. Можна згадати аромати, якість, упаковку, сервіс. Без хештегів."
    )
    catalog = get_detailed_catalog()
    user_prompt = (
        "Зроби відгук узагальненим, але релевантним до нашого асортименту. Якщо доречно — назви 1–2 аромати або типи свічок з каталогу. "
        "Поверни лише текст відгуку."
    )
    data = {"contents": [{"parts": [{"text": sys_prompt + "\n\nКаталог:\n" + catalog + "\n\n" + user_prompt}]}]}
    res = _gemini_request(data)
    if not res:
        return None
    try:
        text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
        return text
    except Exception as e:
        logging.error(f"parse ai review failed: {e}")
    return None

async def post_review_to_channel(context: ContextTypes.DEFAULT_TYPE):
    """Публікація 'відгуку дня' у всі канали."""
    if not CHANNEL_IDS:
        logging.warning("CHANNEL_IDS empty; skip review posting")
        return
    if not REVIEW_ENABLED:
        logging.info("Review posting disabled; skip")
        return
    try:
        text = generate_ai_review_text()
        if not text:
            # М'який фолбек
            text = (
                "Відгук дня:\n"
                "Дуже сподобались свічки від Art Light! Аромат ніжний і тримається довго, "
                "упаковка стильна, а доставка швидка. Обов'язково замовлю ще! ✨"
            )
        local_image = find_relevant_local_image(text) or get_next_local_image_path()
        image_url = None if local_image else (get_test_image_url(seed_text="review of the day") if TEST_IMAGES_ENABLED else None)
        for ch in list(CHANNEL_IDS):
            try:
                target = await resolve_publish_target(context, ch)
                if local_image:
                    with open(local_image, "rb") as f:
                        await context.bot.send_photo(chat_id=target, photo=f, caption=text)
                elif image_url:
                    await context.bot.send_photo(chat_id=target, photo=image_url, caption=text)
                else:
                    await context.bot.send_message(chat_id=target, text=text)
                logging.info(f"Review post published to target {target}")
            except Exception as ce:
                logging.error(f"Failed to post review to {ch}: {ce}")
    except Exception as e:
        logging.error(f"Failed to generate review: {e}")

async def post_instagram_promo(context: ContextTypes.DEFAULT_TYPE):
    if not CHANNEL_IDS:
        logging.warning("CHANNEL_IDS empty; skip promo posting")
        return
    try:
        text = generate_ai_instagram_promo_text()
        if not text:
            # мягкий фолбэк если ИИ не сработал
            text = (
                "Підписуйтеся на наш Instagram, щоб бачити новинки, акції та бекстейдж виробництва! ✨\n"
                f"{INSTAGRAM_URL}"
            )
            if REQUIRE_AI_FOR_CONTENT:
                # при строгом режиме можно пропустить, но для промо оставим фолбэк по умолчанию
                logging.info("AI promo missing; using fallback promo text")
        local_image = find_relevant_local_image(text)
        if not local_image:
            local_image = get_next_local_image_path()
        image_url = None if local_image else (get_test_image_url(seed_text="instagram promo") if TEST_IMAGES_ENABLED else None)
        for ch in list(CHANNEL_IDS):
            try:
                target = await resolve_publish_target(context, ch)
                if local_image:
                    with open(local_image, "rb") as f:
                        await context.bot.send_photo(chat_id=target, photo=f, caption=text)
                elif image_url:
                    await context.bot.send_photo(chat_id=target, photo=image_url, caption=text)
                else:
                    await context.bot.send_message(chat_id=target, text=text)
                logging.info(f"Promo post published to target {target}")
            except Exception as ce:
                logging.error(f"Failed to post promo to {ch}: {ce}")
    except Exception as e:
        logging.error(f"Failed to generate promo: {e}")
    

def _detect_category_slug(text: str) -> str:
    t = (text or "").lower()
    if any(k in t for k in ("майстер", "майстер-клас", "мастер", "мастер-класс", "мк")):
        return "master"
    if any(k in t for k in ("сертифік", "сертифик", "подарунк", "подароч")):
        return "cert"
    if any(k in t for k in ("зниж", "скидк", "акц", "промо")):
        return "sale"
    if any(k in t for k in ("набір", "набор")):
        return "set"
    # default candle/aroma theme
    return "candle"

def _list_images_for_category(slug: str) -> list[str]:
    files = _list_local_images()
    if not files:
        return []
    slug_map = {
        "master": ("master", "class", "mk", "майстер", "класс"),
        "cert": ("cert", "сертиф", "gift", "voucher", "подар"),
        "sale": ("sale", "discount", "акц", "зниж"),
        "set": ("set", "набір", "набор"),
        "candle": ("candle", "свіч", "свеч", "aroma", "scent"),
    }
    keys = slug_map.get(slug, slug_map["candle"])
    result = [p for p in files if any(k in p.lower() for k in keys)]
    return result

def _load_category_index(slug: str, max_len: int) -> int:
    import os
    path = f"{LOCAL_IMAGES_INDEX_PER_CAT_PREFIX}{slug}.txt"
    try:
        if not os.path.exists(path):
            return 0
        with open(path, "r", encoding="utf-8") as f:
            idx = int((f.read() or "0").strip())
            if idx < 0:
                idx = 0
            if max_len > 0:
                idx = idx % max_len
            return idx
    except Exception:
        return 0

def _save_category_index(slug: str, idx: int) -> None:
    path = f"{LOCAL_IMAGES_INDEX_PER_CAT_PREFIX}{slug}.txt"
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(str(idx))
    except Exception:
        pass

def get_next_local_image_for_category(text: str) -> str | None:
    slug = _detect_category_slug(text)
    items = _list_images_for_category(slug)
    if not items:
        return None
    idx = _load_category_index(slug, len(items))
    path = items[idx]
    next_idx = (idx + 1) % len(items)
    _save_category_index(slug, next_idx)
    return path

def find_relevant_local_image(text: str) -> str | None:
    """Підбирає релевантне локальне зображення з `images/` за змістом тексту поста.
    1) Визначає категорію (свічки/акції/набори/сертифікати/МК).
    2) Фільтрує файли категорії.
    3) Оцінює збіги ключових слів у назві файлу.
    4) Повертає найкращий матч або наступне у категорії.
    """
    try:
        slug = _detect_category_slug(text or "")
        items = _list_images_for_category(slug)
        if not items:
            return None
        words = set(re.findall(r"[A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9]+", (text or "").lower()))
        extras = {
            "candle": {"candle", "свеч", "свіч", "aroma", "scent", "soy", "соєв", "парафін"},
            "sale": {"sale", "discount", "зниж", "акц", "promo"},
            "set": {"set", "набір", "набор", "gift"},
            "cert": {"cert", "сертиф", "voucher", "подар"},
            "master": {"master", "class", "mk", "майстер", "класс"},
        }.get(slug, set())
        words |= extras
        def score(p: str) -> int:
            name = os.path.basename(p).lower()
            return sum(1 for w in words if w and w in name)
        best = max(items, key=score)
        if score(best) > 0:
            return best
        return get_next_local_image_for_category(text)
    except Exception:
        return None

async def resolve_publish_target(context: ContextTypes.DEFAULT_TYPE, target: int | str) -> int | str:
    """Resolves a publish target to ensure we post to the channel, not its discussion group.
    - If target is @username (str), return as-is (Telegram will route to the channel).
    - If target is numeric and points to a supergroup with linked channel, return the linked channel id.
    - Otherwise, return target unchanged.
    """
    try:
        if isinstance(target, str):
            return target  # e.g. '@yourchannel'
        # numeric id: fetch chat info
        chat = await context.bot.get_chat(target)
        ctype = getattr(chat, 'type', None)
        linked_id = getattr(chat, 'linked_chat_id', None)
        logging.info(f"Resolve target: id={target}, type={ctype}, linked_chat_id={linked_id}")
        # If it's a supergroup and has a linked channel, publish to that channel
        if ctype in ("group", "supergroup") and linked_id:
            return linked_id
        return target
    except Exception as e:
        logging.warning(f"resolve_publish_target failed for {target}: {e}")
        return target

# 🔹 Лимиты для пользователей
user_limits = {}
MAX_MESSAGES_PER_DAY = 10  # лимит сообщений к ИИ на пользователя

# 🔹 Оператор и переключения
OPERATOR_ID = 1617813030
# Если укажешь ID приватного админ-групп-чата, уведомления и ответы пойдут туда
# Удобно, если оператор не начинал личный чат с ботом (иначе нельзя писать в личку оператору)
ADMIN_CHAT_ID = None  # например: -1001234567890
active_conversations = {}  # {user_id: {"with_operator": True/False, "operator_notified": True/False}}

# 🔹 Модерация
MODERATION_ENABLED = True
moderation_config = {
    "bad_words": {"лох", "дурак", "сука", "бляд", "хуй", "пидор"},  # пример, расширишь по необходимости
    "block_links": True,
    "max_msgs_per_10s": 6,  # флуд-контроль
    "default_mute_minutes": 60,  # дефолтный мут 60 минут
    "escalate_threshold": 3,  # после 3 нарушений — бан
}
user_violations = {}  # {user_id: count}
user_message_times = {}  # {chat_id: {user_id: [timestamps]}}

def has_operator_privilege(update: Update) -> bool:
    """Возвращает True, если команду вызывает оператор (по user_id) или команда пришла из ADMIN_CHAT_ID."""
    try:
        if update.effective_user and update.effective_user.id == OPERATOR_ID:
            return True
        if ADMIN_CHAT_ID and update.effective_chat and update.effective_chat.id == ADMIN_CHAT_ID:
            return True
    except Exception:
        pass
    return False

# 🔹 Планировщик постов в канал (мульти‑каналы)
# Укажем ваш канал и включим планировщик по умолчанию
CHANNEL_IDS = {-1003073221404}  # ваш канал
SCHEDULER_ENABLED = True
POSTS_PER_DAY = 3  # используем 3 таймслота ниже
# Таймзона и расписание
TIMEZONE = "Europe/Kyiv"
# Список времени публикаций (локальное время сервера/или с tz), формат HH:MM
POST_TIMES = ["12:00", "15:00", "19:00"]
# Публиковать один пост сразу при старте
POST_ON_START = True
# Режимы планировщика/содержимого
HOURLY_MODE = True            # включаем почасовой режим публикаций
CONTENT_MIX = "auto"          # "auto" | "poll" | "post"
POLL_PROBABILITY = 0.4        # доля слотов, которые станут опросами, если CONTENT_MIX = "auto"
# Обязательная генерация ИИ только для ПОСТОВ (опросы оставляем как есть)
REQUIRE_AI_FOR_CONTENT = True

# 🔹 Instagram промо
INSTAGRAM_URL = "https://www.instagram.com/art_candel_light?utm_source=qr&igsh=cTR4Z3JzNmV5NjV5"
PROMO_ENABLED = True
PROMO_PROBABILITY = 0.2       # вероятность промо-слота в режиме auto

# 🔹 Відгук дня
REVIEW_ENABLED = True
REVIEW_PROBABILITY = 0.2      # ймовірність слота відгуку в режимі auto

def generate_poll_question() -> tuple[str, list[str]]:
    """Генерирует вопрос опроса и варианты ответов. Использует товары/темы по свечам."""
    base_questions = [
        ("Які свічки ви більше любите?", ["Ароматизовані", "Без аромату", "Соєві", "Парафінові"]),
        ("Який аромат вам ближче?", ["Ваніль", "Цитрус", "Лаванда", "Ягідний", "Деревний"]),
        ("Коли найчастіше запалюєте свічки?", ["Вечірній релакс", "Свята/особливі події", "Під час ванни", "Для аромату вдома"]),
        ("Що цікавить у майстер‑класах?", ["Для початківців", "Просунутий рівень", "Подарункові сертифікати", "Сімейні заняття"]),
    ]
    # Добавим динамику из ассортимента
    try:
        if products:
            titles = [p.get("title", "Свічка") for p in products[:4]]
            if len(titles) >= 2:
                base_questions.append(("Яку свічку виберете сьогодні?", titles))
        elif masterclasses:
            titles = [m.get("title", "МК") for m in masterclasses[:4]]
            base_questions.append(("Який майстер‑клас цікавить найбільше?", titles))
    except Exception:
        pass
    import random
    return random.choice(base_questions)

def _gemini_request(json_payload: dict) -> dict | None:
    try:
        headers = {"Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY}
        r = requests.post(GEMINI_URL, headers=headers, json=json_payload, timeout=30)
        if r.status_code == 200:
            return r.json()
        logging.error(f"Gemini content gen error {r.status_code}: {r.text}")
    except Exception as e:
        logging.error(f"Gemini content gen exception: {e}")
    return None

def generate_ai_poll_from_catalog() -> tuple[str, list[str]] | None:
    """Просим Gemini сгенерировать опрос на основе каталога. Возвращает (question, options) или None."""
    sys_prompt = (
        "Ти — SMM-менеджер магазину свічок Art Light. Згенеруй опитування українською мовою на основі каталогу. "
        "Формат строго JSON без пояснень: {\"question\": str, \"options\": [str, ...]}. "
        "Варіантів 3–6, без номерів і емодзі у варіантах. Коротко і чітко."
    )
    catalog = get_detailed_catalog()
    user_prompt = f"Каталог:\n{catalog}\n\nПоверни тільки JSON."
    data = {"contents": [{"parts": [{"text": sys_prompt + "\n\n" + user_prompt}]}]}
    res = _gemini_request(data)
    if not res:
        return None
    try:
        raw = res["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Попробуем аккуратно извлечь JSON из ответа
        obj = _parse_poll_response_to_json(raw)
        q = obj.get("question") if isinstance(obj, dict) else None
        opts = obj.get("options") if isinstance(obj, dict) else None
        if isinstance(q, str) and isinstance(opts, list):
            q2, opts2 = _sanitize_poll(q, [str(o) for o in opts])
            if len(opts2) >= 2:
                return q2, opts2
    except Exception as e:
        logging.error(f"parse ai poll failed: {e}")
    return None

def _parse_poll_response_to_json(text: str) -> dict | None:
    """Пытается извлечь {question, options[]} из ответа модели.
    Поддерживает варианты: чистый JSON, JSON в ```json, JSON где-то в тексте, или простой список после вопроса.
    """
    try:
        t = text.strip()
        # Снимем обертку ```
        if t.startswith("```"):
            t = t.strip("`\n ")
            if t.lower().startswith("json"):
                t = t[4:].lstrip()
        # Пробуем прямой JSON
        try:
            return json.loads(t)
        except Exception:
            pass
        # Ищем блок JSON в тексте по фигурным скобкам
        import re
        candidates = re.findall(r"\{[\s\S]*?\}", t)
        for cand in candidates:
            try:
                obj = json.loads(cand)
                if isinstance(obj, dict) and "question" in obj and "options" in obj:
                    return obj
            except Exception:
                continue
        # Простой разбор: первая строка — вопрос, следующие 3-6 строк — варианты
        lines = [ln.strip("- •\t ") for ln in t.splitlines() if ln.strip()]
        if len(lines) >= 4:
            q = lines[0]
            opts = lines[1:]
            if 2 <= len(opts) <= 10:
                return {"question": q, "options": opts}
    except Exception:
        pass
    return None

def generate_ai_post_from_catalog() -> str | None:
    """Просим Gemini зробити корисний пост-рекомендацію/підбірку з каталогу (українською)."""
    sys_prompt = (
        "Ти — SMM-менеджер Art Light. Зроби короткий корисний пост українською (3–6 рядків) "
        "з рекомендаціями/підбіркою товарів або порадою по свічках. Без хештегів, доречні емодзі."
    )
    catalog = get_detailed_catalog()
    user_prompt = f"Каталог:\n{catalog}\n\nПоверни тільки текст поста."
    data = {"contents": [{"parts": [{"text": sys_prompt + "\n\n" + user_prompt}]}]}
    res = _gemini_request(data)
    if not res:
        return None
    try:
        text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
        return text
    except Exception as e:
        logging.error(f"parse ai post failed: {e}")
    return None

async def post_poll_to_channel(context: ContextTypes.DEFAULT_TYPE):
    """Публикация опроса (AI приоритет, fallback на шаблон) во все каналы из CHANNEL_IDS."""
    if not CHANNEL_IDS:
        logging.warning("CHANNEL_IDS empty; skip poll posting")
        return
    ai = generate_ai_poll_from_catalog()
    try:
        if ai:
            question, options = ai
        else:
            # Для опросов всегда разрешаем фолбэк на шаблон, даже если REQUIRE_AI_FOR_CONTENT включен
            logging.info("AI did not return poll; using fallback template poll")
            question, options = generate_poll_question()
        for ch in list(CHANNEL_IDS):
            try:
                target = await resolve_publish_target(context, ch)
                await context.bot.send_poll(chat_id=target, question=question, options=options, is_anonymous=True, allows_multiple_answers=False)
                logging.info(f"Poll posted to target {target}")
            except Exception as ce:
                logging.error(f"Failed to post poll to {ch}: {ce}")
    except Exception as e:
        logging.error(f"Failed to generate poll: {e}")

async def post_text_to_channel(context: ContextTypes.DEFAULT_TYPE):
    if not CHANNEL_IDS:
        logging.warning("CHANNEL_IDS empty; skip text posting")
        return
    try:
        text = generate_ai_post_from_catalog()
        if not text:
            # Если требуется ИИ — не публикуем без текста от модели
            if REQUIRE_AI_FOR_CONTENT:
                logging.warning("AI did not return text; skipping text post due to REQUIRE_AI_FOR_CONTENT")
                return
            # Иначе — используем мягкий фолбэк
            question, options = generate_poll_question()
            text = f"Сьогоднішня тема: {question}\nОберіть у коментарях: {', '.join(options[:4])}"
        # Попробуем подобрать релевантное изображение по тексту, затем по очереди, затем тестовый источник
        local_image = find_relevant_local_image(text)
        if not local_image:
            local_image = get_next_local_image_path()
        image_url = None if local_image else (get_test_image_url(seed_text=text) if TEST_IMAGES_ENABLED else None)
        for ch in list(CHANNEL_IDS):
            try:
                target = await resolve_publish_target(context, ch)
                if local_image:
                    # Отправка локального файла
                    f = None
                    try:
                        f = open(local_image, "rb")
                        await context.bot.send_photo(chat_id=target, photo=f, caption=text)
                        logging.info(f"Local photo post published to target {target}: {local_image}")
                    finally:
                        try:
                            if f:
                                f.close()
                        except Exception:
                            pass
                elif image_url:
                    await context.bot.send_photo(chat_id=target, photo=image_url, caption=text)
                    logging.info(f"Photo post published to target {target}")
                else:
                    await context.bot.send_message(chat_id=target, text=text)
                    logging.info(f"Text post published to target {target}")
            except Exception as ce:
                logging.error(f"Failed to post photo to {ch}: {ce}; fallback to text")
                try:
                    target = await resolve_publish_target(context, ch)
                    await context.bot.send_message(chat_id=target, text=text)
                    logging.info(f"Fallback text post published to target {target}")
                except Exception as ce2:
                    logging.error(f"Failed to post text to {ch}: {ce2}")
    except Exception as e:
        logging.error(f"Failed to generate text: {e}")

async def post_scheduled_content(context: ContextTypes.DEFAULT_TYPE):
    """Вибирає тип контенту згідно CONTENT_MIX і публікує його."""
    import random
    if CONTENT_MIX == "poll":
        await post_poll_to_channel(context)
    elif CONTENT_MIX == "post":
        await post_text_to_channel(context)
    else:
        # Розподіляємо: промо -> відгук -> опитування -> звичайний пост
        r = random.random()
        if PROMO_ENABLED and r < PROMO_PROBABILITY:
            await post_instagram_promo(context)
        elif REVIEW_ENABLED and r < PROMO_PROBABILITY + REVIEW_PROBABILITY:
            await post_review_to_channel(context)
        elif r < PROMO_PROBABILITY + REVIEW_PROBABILITY + POLL_PROBABILITY:
            await post_poll_to_channel(context)
        else:
            await post_text_to_channel(context)

def clear_scheduled_jobs(app: Application):
    jq = app.job_queue
    if jq is None:
        logging.error("JobQueue is not available. Install PTB with job-queue: pip install \"python-telegram-bot[job-queue]\"")
        return
    for job in jq.jobs():
        if job.name and (job.name.startswith("daily_poll_") or job.name == "hourly_poll"):
            job.schedule_removal()

def schedule_daily_polls(app: Application):
    """Настраивает ежедневные публикации согласно POST_TIMES и POSTS_PER_DAY."""
    if not SCHEDULER_ENABLED or HOURLY_MODE:
        return
    jq = app.job_queue
    if jq is None:
        logging.error("JobQueue is not available. Install PTB with job-queue: pip install \"python-telegram-bot[job-queue]\"")
        return
    clear_scheduled_jobs(app)
    import datetime as dt
    # Поддержка таймзоны
    try:
        tz = ZoneInfo(TIMEZONE)
    except Exception:
        tz = None
    times = POST_TIMES[:]
    if POSTS_PER_DAY == 2 and len(times) < 2:
        times = times + ["18:00"]
    times = times[:POSTS_PER_DAY]
    for idx, hhmm in enumerate(times):
        try:
            h, m = map(int, hhmm.split(":"))
            if tz is not None:
                t = dt.time(hour=h, minute=m, tzinfo=tz)
            else:
                t = dt.time(hour=h, minute=m)
            jq.run_daily(post_scheduled_content, time=t, name=f"daily_poll_{idx}")
            logging.info(f"Scheduled daily poll at {hhmm}")
        except Exception as e:
            logging.error(f"Bad time format {hhmm}: {e}")

def schedule_hourly(app: Application):
    if not SCHEDULER_ENABLED or not HOURLY_MODE:
        return
    jq = app.job_queue
    if jq is None:
        logging.error("JobQueue is not available. Install PTB with job-queue: pip install \"python-telegram-bot[job-queue]\"")
        return
    clear_scheduled_jobs(app)
    # Каждые 60 минут, первая публикация через час
    jq.run_repeating(post_scheduled_content, interval=3600, first=3600, name="hourly_poll")
    logging.info("Scheduled hourly polls every 60 minutes")

async def cmd_hourly_on(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global HOURLY_MODE
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    HOURLY_MODE = True
    schedule_hourly(context.application)
    await update.message.reply_text("✅ HOURLY_MODE = True (щогодини)")

async def cmd_hourly_off(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global HOURLY_MODE
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    HOURLY_MODE = False
    schedule_daily_polls(context.application)
    await update.message.reply_text("⏸️ HOURLY_MODE = False (щоденні пости)")

async def cmd_set_review_prob(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global REVIEW_PROBABILITY
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        val = float(context.args[0])
        if not (0.0 <= val <= 1.0):
            raise ValueError
        REVIEW_PROBABILITY = val
        await update.message.reply_text(f"✅ REVIEW_PROBABILITY = {REVIEW_PROBABILITY}")
    except Exception:
        await update.message.reply_text("📝 Використання: /set_review_prob <0..1>")

async def cmd_setchannel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CHANNEL_IDS
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        ch = int(context.args[0])
        CHANNEL_IDS.add(ch)
        await update.message.reply_text(f"✅ Додано канал: {ch}")
    except Exception:
        await update.message.reply_text("📝 Використання: /setchannel <channel_id>")

async def cmd_addchannel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await cmd_setchannel(update, context)

async def cmd_rmchannel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CHANNEL_IDS
    if update.effective_user.id != OPERATOR_ID:
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        ch = int(context.args[0])
        CHANNEL_IDS.discard(ch)
        await update.message.reply_text(f"🗑️ Видалено канал: {ch}")
    except Exception:
        await update.message.reply_text("📝 Використання: /rmchannel <channel_id>")

async def cmd_listchannels(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not CHANNEL_IDS:
        await update.message.reply_text("Список каналів порожній")
        return
    await update.message.reply_text("Канали:\n" + "\n".join(str(c) for c in sorted(CHANNEL_IDS)))

async def cmd_scheduler_on(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global SCHEDULER_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    SCHEDULER_ENABLED = True
    schedule_daily_polls(context.application)
    await update.message.reply_text("✅ Планувальник ввімкнено")

async def cmd_scheduler_off(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global SCHEDULER_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    SCHEDULER_ENABLED = False
    # Удалим задания
    for job in context.application.job_queue.jobs():
        if job.name and job.name.startswith("daily_poll_"):
            job.schedule_removal()
    await update.message.reply_text("⏸️ Планувальник вимкнено")

async def cmd_scheduler_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Статус планувальника:\n"
        f"- CHANNEL_IDS: {', '.join(str(c) for c in sorted(CHANNEL_IDS))}\n"
        f"- enabled: {SCHEDULER_ENABLED}\n"
        f"- HOURLY_MODE: {HOURLY_MODE}\n"
        f"- POSTS_PER_DAY: {POSTS_PER_DAY}\n"
        f"- POST_TIMES: {', '.join(POST_TIMES)}\n"
        f"- CONTENT_MIX: {CONTENT_MIX} (POLL_PROBABILITY={POLL_PROBABILITY})\n"
        f"- PROMO_ENABLED: {PROMO_ENABLED} (PROMO_PROBABILITY={PROMO_PROBABILITY})\n"
        f"- REQUIRE_AI_FOR_CONTENT: {REQUIRE_AI_FOR_CONTENT}\n"
        "Бот має бути адміністратором каналу."
    )

async def cmd_set_post_times(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global POST_TIMES
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        # формат: /set_post_times 11:00,18:30
        arg = context.args[0]
        POST_TIMES = [p.strip() for p in arg.split(",") if p.strip()]
        schedule_daily_polls(context.application)
        await update.message.reply_text(f"✅ POST_TIMES = {POST_TIMES}")
    except Exception:
        await update.message.reply_text("📝 Використання: /set_post_times HH:MM[,HH:MM]")

async def cmd_set_posts_per_day(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global POSTS_PER_DAY
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        n = int(context.args[0])
        if n not in (1, 2):
            raise ValueError("only 1 or 2")
        POSTS_PER_DAY = n
        schedule_daily_polls(context.application)
        await update.message.reply_text(f"✅ POSTS_PER_DAY = {POSTS_PER_DAY}")
    except Exception:
        await update.message.reply_text("📝 Використання: /set_posts_per_day <1|2>")

async def cmd_post_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    await post_scheduled_content(context)
    await update.message.reply_text("📤 Пост відправлено (якщо додані канали)")

from telegram.ext import ChatMemberHandler

def extract_status_change(old, new):
    return (old is None or old.status != new.status)

async def my_chat_member_update(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Автоматично додає/видаляє канал при зміні статуса бота в каналі."""
    try:
        mcm = update.my_chat_member
        if not mcm or not mcm.chat:
            return
        chat = mcm.chat
        if chat.type != "channel":
            return
        old = mcm.old_chat_member
        new = mcm.new_chat_member
        if extract_status_change(old, new):
            # если бот стал админом/участником канала — добавим
            if new.status in ("administrator", "member"):
                CHANNEL_IDS.add(chat.id)
                logging.info(f"Auto-added channel {chat.id}")
            # если бот кикнут/не админ — удалим
            if new.status in ("left", "kicked"):
                CHANNEL_IDS.discard(chat.id)
                logging.info(f"Auto-removed channel {chat.id}")
    except Exception as e:
        logging.error(f"my_chat_member_update error: {e}")

async def cmd_set_mix(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CONTENT_MIX
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        val = context.args[0].lower()
        if val not in ("auto", "poll", "post"):
            raise ValueError("bad value")
        CONTENT_MIX = val
        await update.message.reply_text(f"✅ CONTENT_MIX = {CONTENT_MIX}")
    except Exception:
        await update.message.reply_text("📝 Використання: /set_mix <auto|poll|post>")

async def cmd_review_on(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global REVIEW_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    REVIEW_ENABLED = True
    await update.message.reply_text("✅ REVIEW_ENABLED = True")

async def cmd_review_off(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global REVIEW_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    REVIEW_ENABLED = False
    await update.message.reply_text("⏸️ REVIEW_ENABLED = False")

async def post_review_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    await post_review_to_channel(context)
    await update.message.reply_text("📝 Відгук дня відправлено")

async def cmd_set_poll_prob(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global POLL_PROBABILITY
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        val = float(context.args[0])
        if not (0.0 <= val <= 1.0):
            raise ValueError
        POLL_PROBABILITY = val
        await update.message.reply_text(f"✅ POLL_PROBABILITY = {POLL_PROBABILITY}")
    except Exception:
        await update.message.reply_text("📝 Використання: /set_poll_prob <0..1>")

async def cmd_set_promo_prob(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global PROMO_PROBABILITY
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        val = float(context.args[0])
        if not (0.0 <= val <= 1.0):
            raise ValueError
        PROMO_PROBABILITY = val
        await update.message.reply_text(f"✅ PROMO_PROBABILITY = {PROMO_PROBABILITY}")
    except Exception:
        await update.message.reply_text("📝 Використання: /set_promo_prob <0..1>")

async def promo_on(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global PROMO_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    PROMO_ENABLED = True
    await update.message.reply_text("✅ Instagram промо увімкнено")

async def promo_off(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global PROMO_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    PROMO_ENABLED = False
    await update.message.reply_text("⏸️ Instagram промо вимкнено")

async def post_promo_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    await post_instagram_promo(context)
    await update.message.reply_text("📣 Промо-повідомлення Instagram відправлено")

async def post_poll_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    await post_poll_to_channel(context)
    await update.message.reply_text("📊 Опрос отправлен (если додані канали і ІІ згенерував)")

async def cmd_set_require_ai(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Переключити режим: посты только от ИИ или с фолбэком. /set_require_ai <on|off>"""
    global REQUIRE_AI_FOR_CONTENT
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    try:
        val = (context.args[0].lower() if context.args else "").strip()
        if val not in ("on", "off"):
            raise ValueError
        REQUIRE_AI_FOR_CONTENT = (val == "on")
        await update.message.reply_text(f"✅ REQUIRE_AI_FOR_CONTENT = {REQUIRE_AI_FOR_CONTENT}")
    except Exception:
        await update.message.reply_text("📝 Використання: /set_require_ai <on|off>")

async def debug_priv(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Диагностика прав: показывает user_id, chat_id, ADMIN_CHAT_ID, OPERATOR_ID и итог has_operator_privilege()."""
    uid = update.effective_user.id if update.effective_user else None
    cid = update.effective_chat.id if update.effective_chat else None
    ctype = update.effective_chat.type if update.effective_chat else None
    allowed = has_operator_privilege(update)
    text = (
        f"user_id: {uid}\n"
        f"chat_id: {cid} ({ctype})\n"
        f"ADMIN_CHAT_ID: {ADMIN_CHAT_ID}\n"
        f"OPERATOR_ID: {OPERATOR_ID}\n"
        f"allowed: {allowed}"
    )
    await update.message.reply_text(text)

# ======================
# 🔹 Реальные модерационные действия (бан/мут)
# ======================

def _ensure_group_chat(update: Update) -> bool:
    return bool(update.effective_chat and update.effective_chat.type in ("group", "supergroup"))

async def _resolve_moderation_chat_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int | None:
    """Возвращает chat_id для модерации. Если команда вызвана в канале с включенными комментариями,
    использует связанный discussion group (linked_chat_id)."""
    chat = update.effective_chat
    if not chat:
        return None
    if chat.type in ("group", "supergroup"):
        return chat.id
    if chat.type == "channel":
        try:
            full = await context.bot.get_chat(chat.id)
            linked_id = getattr(full, "linked_chat_id", None)
            return linked_id
        except Exception:
            return None
    return None

async def _bot_can_moderate(context: ContextTypes.DEFAULT_TYPE, chat_id: int, target_user_id: int) -> tuple[bool, str]:
    """Проверяет, что бот админ с правами бан/мут и цель не админ/владелец."""
    try:
        me = await context.bot.get_me()
        bot_member = await context.bot.get_chat_member(chat_id, me.id)
        can_restrict = getattr(getattr(bot_member, "can_restrict_members", None), "__bool__", lambda: False)()
        # PTB 20: у ChatMemberAdministrator есть поля can_restrict_members, у владельца — True
        status = getattr(bot_member, "status", "member")
        if status not in ("administrator", "creator"):
            return False, "Бот не администратор в этом чате"
        if not can_restrict and status != "creator":
            return False, "Боту не выданы права на ограничение/бан участников"
        target = await context.bot.get_chat_member(chat_id, target_user_id)
        t_status = getattr(target, "status", "member")
        if t_status in ("administrator", "creator"):
            return False, "Нельзя ограничить администратора або власника"
        return True, "OK"
    except Exception as e:
        return False, f"Перевірка прав не вдалася: {e}"

async def cmd_ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/ban <user_id> [minutes]
    Банит пользователя в текущем групповом чате. minutes=0 или отсутсвует — навсегда.
    """
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    if not _ensure_group_chat(update):
        await update.message.reply_text("Команда доступна только в групповом/супергрупповом чате")
        return
    try:
        uid = int(context.args[0])
        minutes = int(context.args[1]) if len(context.args) >= 2 else 0
        until_date = None
        if minutes > 0:
            until_date = datetime.utcnow() + timedelta(minutes=minutes)
        await context.bot.ban_chat_member(chat_id=update.effective_chat.id, user_id=uid, until_date=until_date)
        await update.message.reply_text(f"🛑 Користувач {uid} забанений{' на ' + str(minutes) + ' хв' if minutes>0 else ' назавжди'}.")
    except Exception as e:
        await update.message.reply_text(f"❌ Помилка бану: {e}")

async def cmd_unban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    chat_id = await _resolve_moderation_chat_id(update, context)
    if not chat_id:
        await update.message.reply_text("Не знайдено чат для модерації")
        return
    try:
        uid = int(context.args[0])
        await context.bot.unban_chat_member(chat_id=chat_id, user_id=uid, only_if_banned=False)
        await update.message.reply_text(f"✅ Користувача {uid} розбанено")
    except Exception as e:
        await update.message.reply_text(f"❌ Помилка розбану: {e}")

async def cmd_mute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/mute <user_id> <minutes>
    Обмежує права користувача на відправку повідомлень на N хвилин.
    """
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    chat_id = await _resolve_moderation_chat_id(update, context)
    if not chat_id:
        await update.message.reply_text("Не знайдено чат для модерації")
        return
    try:
        uid = int(context.args[0])
        minutes = int(context.args[1])
        ok, why = await _bot_can_moderate(context, chat_id, uid)
        if not ok:
            await update.message.reply_text(f"❌ {why}")
            return
        until_ts = int(time.time()) + minutes * 60
        perms = ChatPermissions(
            can_send_messages=False,
            can_send_audios=False,
            can_send_documents=False,
            can_send_photos=False,
            can_send_videos=False,
            can_send_video_notes=False,
            can_send_voice_notes=False,
            can_send_polls=False,
            can_send_other_messages=False,
            can_add_web_page_previews=False,
        )
        await context.bot.restrict_chat_member(chat_id=chat_id, user_id=uid, permissions=perms, until_date=until_ts)
        await update.message.reply_text(f"🤐 Користувача {uid} зам'ючено на {minutes} хв")
    except Exception as e:
        await update.message.reply_text(f"❌ Помилка мута: {e}")

async def cmd_unmute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ Немає прав.")
        return
    chat_id = await _resolve_moderation_chat_id(update, context)
    if not chat_id:
        await update.message.reply_text("Не знайдено чат для модерації")
        return
    try:
        uid = int(context.args[0])
        perms = ChatPermissions(
            can_send_messages=True,
            can_send_audios=True,
            can_send_documents=True,
            can_send_photos=True,
            can_send_videos=True,
            can_send_video_notes=True,
            can_send_voice_notes=True,
            can_send_polls=True,
            can_send_other_messages=True,
            can_add_web_page_previews=True,
        )
        await context.bot.restrict_chat_member(chat_id=chat_id, user_id=uid, permissions=perms)
        await update.message.reply_text(f"🔊 Користувача {uid} розм'ючено")
    except Exception as e:
        await update.message.reply_text(f"❌ Помилка розм'юта: {e}")

async def cmd_self_mute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Користувач сам просить тимчасовий мут: /self_mute <minutes>"""
    if not _ensure_group_chat(update):
        await update.message.reply_text("Команда доступна только в групповом/супергрупповом чате")
        return
    try:
        minutes = int(context.args[0]) if context.args else 10
        until_ts = int(time.time()) + minutes * 60
        perms = ChatPermissions(
            can_send_messages=False,
            can_send_audios=False,
            can_send_documents=False,
            can_send_photos=False,
            can_send_videos=False,
            can_send_video_notes=False,
            can_send_voice_notes=False,
            can_send_polls=False,
            can_send_other_messages=False,
            can_add_web_page_previews=False,
        )
        await context.bot.restrict_chat_member(
            chat_id=update.effective_chat.id,
            user_id=update.effective_user.id,
            permissions=perms,
            until_date=until_ts,
        )
        await update.message.reply_text(f"🧘 Ви тимчасово вимкнули собі чат на {minutes} хв")
    except Exception as e:
        await update.message.reply_text(f"❌ Не вдалося: {e}")

async def cmd_self_ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Користувач сам просить бан: /self_ban [minutes], 0 — назавжди"""
    if not _ensure_group_chat(update):
        await update.message.reply_text("Команда доступна только в групповом/супергрупповом чате")
        return
    try:
        minutes = int(context.args[0]) if context.args else 0
        until_date = None if minutes <= 0 else (int(time.time()) + minutes * 60)
        await context.bot.ban_chat_member(chat_id=update.effective_chat.id, user_id=update.effective_user.id, until_date=until_date)
        await update.message.reply_text("🚪 Ви покинули чат за власним запитом. Повертайтеся, коли будете готові 😊")
    except Exception as e:
        await update.message.reply_text(f"❌ Не вдалося: {e}")

# ======================
# 🔹 Функции
# ======================

def find_product(query: str):
    """Поиск товара по названию"""
    query = query.lower()
    for p in products:
        if query in p["title"].lower():
            return p
    return None

def find_masterclass(query: str):
    """Поиск мастер-класса по названию"""
    query = query.lower()
    for mc in masterclasses:
        if query in mc["title"].lower() or query in mc.get("description", "").lower():
            return mc
    return None

def find_set(query: str):
    """Поиск набора по названию"""
    query = query.lower()
    for s in sets:
        if query in s["title"].lower() or query in s.get("description", "").lower():
            return s
    return None

def get_detailed_catalog():
    """Создает детальный каталог товаров, мастер-классов и наборов для ИИ"""
    catalog_text = ""
    
    # Добавляем товары
    if products:
        catalog_text += "🕯️ СВІЧКИ:\n"
        for i, p in enumerate(products[:10], 1):  # Ограничиваем до 10 товаров
            title = p.get('title', 'Без названия')
            description = p.get('description', 'Без описания')[:150]  # Обрезаем описание
            price = p.get('price', 'Цена не указана')
            discount = p.get('discount', 0)
            specs = p.get('specs', [])
            
            final_price = price
            if discount > 0 and isinstance(price, (int, float)):
                final_price = price * (100 - discount) / 100
                
            catalog_text += f"\n{i}. {title}\n"
            catalog_text += f"   Опис: {description}...\n"
            catalog_text += f"   Ціна: {price} грн"
            if discount > 0:
                catalog_text += f" (зі знижкою {discount}%: {final_price:.0f} грн)"
            catalog_text += "\n"
            if specs:
                catalog_text += f"   Характеристики: {', '.join(specs)}\n"
            catalog_text += "\n"
    
    # Добавляем мастер-классы
    if masterclasses:
        catalog_text += "\n🎓 МАЙСТЕР-КЛАСИ:\n"
        for i, mc in enumerate(masterclasses, 1):
            title = mc.get('title', 'Без названия')
            description = mc.get('description', 'Без описания')[:150]
            price = mc.get('price', 'Цена не указана')
            duration = mc.get('duration', 'Не указано')
            level = mc.get('level', 'Не указан')
            
            catalog_text += f"\n{i}. {title}\n"
            catalog_text += f"   Опис: {description}...\n"
            catalog_text += f"   Ціна: {price} грн\n"
            catalog_text += f"   Тривалість: {duration}\n"
            catalog_text += f"   Рівень: {level}\n\n"
    
    # Добавляем наборы
    if sets:
        catalog_text += "\n🧩 НАБОРИ:\n"
        for i, s in enumerate(sets, 1):
            title = s.get('title', 'Без названия')
            description = s.get('description', 'Без описания')[:150]
            price = s.get('price', 'Цена не указана')
            discount = s.get('discount', 0)
            items = s.get('items', [])
            
            final_price = price
            if discount > 0 and isinstance(price, (int, float)):
                final_price = price * (100 - discount) / 100
                
            catalog_text += f"\n{i}. {title}\n"
            catalog_text += f"   Опис: {description}...\n"
            catalog_text += f"   Ціна: {price} грн"
            if discount > 0:
                catalog_text += f" (зі знижкою {discount}%: {final_price:.0f} грн)"
            catalog_text += "\n"
            if items:
                catalog_text += f"   Склад набору: {len(items)} предметів\n"
            catalog_text += "\n"
    
    return catalog_text

def should_transfer_to_operator(message: str) -> bool:
    """Определяет, нужно ли переключить на оператора"""
    transfer_keywords = [
        'оператор', 'живой человек', 'менеджер', 'консультант',
        'жалоба', 'проблема', 'не работает', 'ошибка',
        'возврат', 'обмен', 'рекламация', 'претензия',
        'заказ', 'доставка', 'оплата', 'статус заказа',
        'технические проблемы', 'сайт не работает'
    ]
    
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in transfer_keywords)

def ask_gemini(prompt: str) -> str:
    """Запрос к Gemini API с системными инструкциями"""
    
    # Системный промпт для консультанта магазина свечей
    system_prompt = f"""Ти — віртуальний консультант інтернет-магазину Art Light. 

ТВОЇ ЗАВДАННЯ:
• Допомагати покупцям з вибором свічок, мастер-класів та наборів
• Відповідати на питання про характеристики, наявність та ціни
• Рекомендувати товари на основі побажань клієнта
• Розказувати про акції та знижки
• Консультувати по мастер-класах (тривалість, рівень складності)
• Пояснювати склад наборів

ПРАВИЛА РОБОТИ:
• Відповідай ввічливо, стисло і зрозуміло українською мовою
• Використовуй каталог як основне джерело інформації
• Якщо немає потрібної інформації, чесно кажи про це
• При технічних питаннях (замовлення, доставка, оплата, проблеми сайту) - ОБОВ'ЯЗКОВО пропонуй зв'язатися з оператором

КОЛИ ПЕРЕКЛЮЧАТИ НА ОПЕРАТОРА:
Якщо клієнт питає про:
- Оформлення замовлення
- Доставку та оплату  
- Статус замовлення
- Технічні проблеми
- Повернення/обмін товару
- Або прямо просить оператора

ПОВНИЙ КАТАЛОГ:
{get_detailed_catalog()}

ПИТАННЯ КОРИСТУВАЧА: {prompt}

ТВОЯ ВІДПОВІДЬ (українською мовою):"""

    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    data = {
        "contents": [
            {
                "parts": [{"text": system_prompt}]
            }
        ]
    }
    try:
        logger.debug(f"Отправляем промпт к Gemini (длина: {len(system_prompt)} символов)")
        response = requests.post(GEMINI_URL, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            res_json = response.json()
            answer = res_json["candidates"][0]["content"]["parts"][0]["text"]
            logger.info(f"Получен ответ от Gemini (длина: {len(answer)} символов)")
            return answer
        else:
            logger.error(f"Ошибка Gemini API: статус {response.status_code}, ответ: {response.text}")
            return f"⚠️ Ошибка Gemini API: {response.status_code}"
    except requests.exceptions.Timeout:
        logger.error("Таймаут при обращении к Gemini API")
        return "⚠️ Превышено время ожидания ответа от ИИ. Попробуйте позже."
    except Exception as e:
        logger.error(f"Исключение при обращении к Gemini API: {e}")
        return f"⚠️ Ошибка при обращении к ИИ: {str(e)}"

def get_thread_kwargs(message):
    """Возвращает kwargs с message_thread_id, если сообщение из треда (темы) супергруппы.
    Это нужно, чтобы бот отвечал именно в том же треде обсуждения канала.
    """
    try:
        if getattr(message, "is_topic_message", False) and getattr(message, "message_thread_id", None):
            return {"message_thread_id": message.message_thread_id}
    except Exception:
        pass
    return {}

def is_link(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return ("http://" in lowered) or ("https://" in lowered) or ("t.me/" in lowered) or (".com" in lowered) or (".ru" in lowered) or (".ua" in lowered)

def detect_violation(chat_type: str, user_id: int, text: str, chat_id: int) -> tuple[str | None, int | None, str | None]:
    """Возвращает (action, duration_seconds, reason) или (None, None, None).
    action: 'mute' | 'ban'
    """
    if chat_type not in ("group", "supergroup"):
        return (None, None, None)
    if not MODERATION_ENABLED:
        return (None, None, None)

    reason = None

    # 1) Запрещённые слова
    if text:
        low = text.lower()
        for w in moderation_config["bad_words"]:
            if w in low:
                reason = f"Нецензурная лексика: {w}"
                break

    # 2) Ссылки/реклама
    if not reason and moderation_config.get("block_links") and is_link(text or ""):
        reason = "Запрещены ссылки/реклама"

    # 3) Флуд
    now = datetime.utcnow()
    bucket = user_message_times.setdefault(chat_id, {}).setdefault(user_id, [])
    bucket.append(now)
    # удаляем старые >10s
    ten_sec_ago = now - timedelta(seconds=10)
    bucket[:] = [t for t in bucket if t >= ten_sec_ago]
    if not reason and len(bucket) > moderation_config["max_msgs_per_10s"]:
        reason = "Флуд (слишком много сообщений за короткое время)"

    if not reason:
        return (None, None, None)

    # Эскалация: увеличиваем счётчик нарушений
    cnt = user_violations.get(user_id, 0) + 1
    user_violations[user_id] = cnt

    if cnt >= moderation_config["escalate_threshold"]:
        return ("ban", None, reason)

    # Иначе мут на N минут
    minutes = moderation_config["default_mute_minutes"]
    return ("mute", minutes * 60, reason)

async def apply_moderation_action(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user_id: int, action: str, duration_seconds: int | None, reason: str, thread_kwargs: dict):
    try:
        if action == "ban":
            await context.bot.ban_chat_member(chat_id=chat_id, user_id=user_id)
            await context.bot.send_message(chat_id, f"🚫 Користувача {user_id} заблоковано. Причина: {reason}", **thread_kwargs)
        elif action == "mute":
            until = datetime.utcnow() + timedelta(seconds=duration_seconds or 0)
            perms = ChatPermissions(can_send_messages=False)
            await context.bot.restrict_chat_member(chat_id=chat_id, user_id=user_id, permissions=perms, until_date=until)
            mins = (duration_seconds or 0) // 60
            await context.bot.send_message(chat_id, f"🔇 Користувача {user_id} обмежено на {mins} хв. Причина: {reason}", **thread_kwargs)
    except Exception as e:
        logging.error(f"Moderation action failed: {e}")

def operator_button_for_message(message, user_id: int) -> InlineKeyboardButton:
    """Создает кнопку связи с оператором.
    В группах/супергруппах открывает приватный бот @artlightsupportbot через deep link,
    в личных чатах использует callback для переключения внутри текущего диалога.
    """
    try:
        chat = message.chat
        if chat and chat.type in ("group", "supergroup"):
            # deep link в приватного бота поддержки
            url = f"https://t.me/artlightsupportbot?start=from_group_{chat.id}"
            return InlineKeyboardButton("👨‍💼 Связаться с оператором", url=url)
    except Exception:
        pass
    return InlineKeyboardButton("👨‍💼 Связаться с оператором", callback_data=f"contact_operator_{user_id}")

async def transfer_to_operator(update: Update, context: ContextTypes.DEFAULT_TYPE, reason: str = ""):
    """Переключает пользователя на оператора"""
    user = update.effective_user
    user_id = user.id
    
    # Отмечаем, что пользователь переключен на оператора
    # Источник запроса (для группового обсуждения важно сохранить чат/тред)
    src_chat = update.effective_chat
    src_thread_id = getattr(update.message, "message_thread_id", None)

    active_conversations[user_id] = {
        "with_operator": True, 
        "operator_notified": False,
        "accepted": False,
        "source": {
            "chat_id": src_chat.id if src_chat else None,
            "chat_type": src_chat.type if src_chat else None,
            "thread_id": src_thread_id,
            "last_msg_id": update.message.message_id if update.message else None,
        },
        "user_info": {
            "id": user_id,
            "name": user.full_name,
            "username": user.username
        }
    }
    
    # Уведомляем пользователя
    await update.message.reply_text(
        "🔄 Переключаю вас на живого оператора...\n"
        "⏳ Очікуйте, оператор скоро з вами зв'яжеться!\n\n"
        "💬 Можете продовжувати писати - всі повідомлення будуть передані оператору."
    , **get_thread_kwargs(update.message))
    
    # Уведомляем оператора карточкой
    try:
        ok = await send_operator_request_card(
            context=context,
            user_obj=user,
            last_text=update.message.text,
            source=active_conversations[user_id]["source"],
            reason=reason
        )
        if ok:
            active_conversations[user_id]["operator_notified"] = True
            logger.info(f"Пользователь {user_id} переключен на оператора. Оператор уведомлен.")
        else:
            raise RuntimeError("operator notification failed")
    except Exception as e:
        logger.error(f"Ошибка при уведомлении оператора: {e}")
        # Если не удалось уведомить оператора (например, оператор не начинал ЛС с ботом),
        # показываем пользователю кнопку для перехода в бота поддержки
        try:
            deep_link_btn = InlineKeyboardButton(
                "👨‍💼 Відкрити бота підтримки",
                url="https://t.me/artlightsupportbot?start=from_dm"
            )
            await update.message.reply_text(
                "⚠️ Тимчасово не вдалося переключити на оператора.\n"
                "Будь ласка, перейдіть у нашого бота підтримки за посиланням нижче.",
                reply_markup=InlineKeyboardMarkup([[deep_link_btn]])
            )
        except Exception:
            await update.message.reply_text(
                "⚠️ Произошла ошибка при переключении на оператора. "
                "Попробуйте позже или свяжитесь с нами другим способом."
            )

async def handle_operator_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обрабатывает сообщения от оператора"""
    # Разрешаем сообщения от оператора (личка) или из админ-группы
    if ADMIN_CHAT_ID and update.effective_chat and update.effective_chat.id == ADMIN_CHAT_ID:
        pass
    elif update.effective_user.id != OPERATOR_ID:
        return False
        
    # Если оператор отвечает на сообщение пользователя
    if update.message.reply_to_message:
        # Извлекаем ID пользователя из сообщения
        original_text = update.message.reply_to_message.text
        import re
        user_id_match = re.search(r'ID:\s*`?(\d+)`?', original_text)
        
        if user_id_match:
            target_user_id = int(user_id_match.group(1))
            operator_response = update.message.text
            
            try:
                conv = active_conversations.get(target_user_id)
                # Если известен исходный групповой чат — отвечаем в треде группы
                if conv and conv.get("source", {}).get("chat_id"):
                    src = conv["source"]
                    kwargs = {}
                    if src.get("thread_id"):
                        kwargs["message_thread_id"] = src["thread_id"]
                    await context.bot.send_message(
                        chat_id=src["chat_id"],
                        text=f"👨‍💼 Відповідь оператора:\n\n{operator_response}",
                        parse_mode='Markdown',
                        **kwargs
                    )
                else:
                    # Фолбэк: отправить в личку пользователю
                    await context.bot.send_message(
                        chat_id=target_user_id,
                        text=f"👨‍💼 **Ответ оператора:**\n\n{operator_response}",
                        parse_mode='Markdown'
                    )
                
                await update.message.reply_text("✅ Сообщение отправлено пользователю!")
                logger.info(f"Оператор ответил пользователю {target_user_id}")
                return True
                
            except Exception as e:
                await update.message.reply_text(f"❌ Ошибка отправки: {e}")
                logger.error(f"Ошибка отправки ответа оператора: {e}")
                
    # Если это не reply: попробуем определить активный принятый разговор
    # Если ровно один разговор принят — считаем его текущим
    accepted = [uid for uid, d in active_conversations.items() if d.get("accepted")]
    if len(accepted) == 1:
        target_user_id = accepted[0]
        operator_response = update.message.text
        conv = active_conversations.get(target_user_id)
        try:
            if conv and conv.get("source", {}).get("chat_id"):
                src = conv["source"]
                kwargs = {}
                if src.get("thread_id"):
                    kwargs["message_thread_id"] = src["thread_id"]
                await context.bot.send_message(
                    chat_id=src["chat_id"],
                    text=f"👨‍💼 Відповідь оператора:\n\n{operator_response}",
                    parse_mode='Markdown',
                    **kwargs
                )
            else:
                await context.bot.send_message(
                    chat_id=target_user_id,
                    text=f"👨‍💼 **Ответ оператора:**\n\n{operator_response}",
                    parse_mode='Markdown'
                )
            await update.message.reply_text("✅ Сообщение отправлено (по принятому чату)")
            logger.info(f"Оператор ответил пользователю {target_user_id} (accepted context)")
            return True
        except Exception as e:
            await update.message.reply_text(f"❌ Ошибка отправки: {e}")
            logger.error(f"Ошибка отправки ответа оператора (accepted): {e}")

    return False

# ======================
# 🔹 Handlers
# ======================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    logger.info(f"Пользователь {user.full_name} (ID: {user.id}) запустил бота")
    
    welcome_text = f"""🕯️ Привіт! Я віртуальний консультант магазину свічок Art Light!

🛍️ Я можу допомогти тобі:
• Знайти потрібну свічку 🕯️
• Розказати про мастер-класи 🎓
• Показати наші набори 🧩
• Відповісти на питання про ціни та характеристики
• Порадити щось цікаве з нашого асортименту

📊 Наш асортимент:
🕯️ Свічки: {len(products)} шт.
🎓 Мастер-класи: {len(masterclasses)} шт.
🧩 Набори: {len(sets)} шт.

Просто напиши назву товару, мастер-класу або набору, або задай будь-яке питання! 💬"""
    
    await update.message.reply_text(welcome_text)

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    user = update.effective_user
    user_id = user.id  # ВАЖНО: идентификатор пользователя, а не чата
    text = update.message.text.strip()
    
    # Диагностика для групп/тредов
    chat = update.effective_chat
    is_topic = getattr(update.message, "is_topic_message", False)
    thread_id = getattr(update.message, "message_thread_id", None)
    logger.info(
        f"Получено сообщение от {user.full_name} (user_id: {user_id}, chat_id: {chat_id}, chat_type: {chat.type}, "
        f"is_topic: {is_topic}, thread_id: {thread_id}): {text}"
    )

    # Автомодерация: до любой другой логики
    action, duration, reason = detect_violation(chat.type, user_id, text, chat_id)
    if action:
        await apply_moderation_action(context, chat_id, user_id, action, duration, reason, get_thread_kwargs(update.message))
        return

    # Сообщения оператора в группах: отвечать только если есть вопросительный знак
    if chat.type in ("group", "supergroup") and user.id == OPERATOR_ID:
        if "?" not in (text or ""):
            return

    # Проверяем, не сообщение ли от оператора
    if await handle_operator_message(update, context):
        return

    # Проверяем, переключен ли пользователь на оператора
    if user_id in active_conversations and active_conversations[user_id].get("with_operator"):
        # Если это группа/супергруппа — ничего не делаем (оператор отвечает публично), AI не отвечает
        if chat.type in ("group", "supergroup"):
            logger.info(f"Пользователь {user_id} в режиме общения с оператором (group); AI подавлен.")
            return
        # В личном чате — при первой возможности отправляем карточку, если ее еще не было
        if not active_conversations[user_id].get("operator_notified"):
            ok = await send_operator_request_card(
                context=context,
                user_obj=user,
                last_text=text,
                source=active_conversations[user_id].get("source", {})
            )
            if ok:
                active_conversations[user_id]["operator_notified"] = True
        # Пересылаем сообщение оператору и не вызываем AI
        try:
            await context.bot.send_message(
                chat_id=ADMIN_CHAT_ID if ADMIN_CHAT_ID else OPERATOR_ID,
                text=f"💬 **Сообщение от {user.full_name}** (ID: `{user_id}`):\n\n_{text}_",
                parse_mode='Markdown'
            )
            await update.message.reply_text("📤 Ваше повідомлення передано оператору!", **get_thread_kwargs(update.message))
            logger.info(f"Сообщение от пользователя {user_id} передано оператору")
            return
        except Exception as e:
            logger.error(f"Ошибка пересылки сообщения оператору: {e}")

    # Проверяем, нужно ли переключить на оператора
    if should_transfer_to_operator(text):
        # В группах не переводим на оператора внутри группы — даём ссылку на приватного бота поддержки
        if chat.type in ("group", "supergroup"):
            deep_link_btn = operator_button_for_message(update.message, user_id)
            await update.message.reply_text(
                "👨‍💼 Щоб поспілкуватися з оператором, перейдіть у нашого бота підтримки.\n"
                "Натисніть кнопку нижче, будь ласка.",
                reply_markup=InlineKeyboardMarkup([[deep_link_btn]]),
                **get_thread_kwargs(update.message)
            )
            return
        # В личных чатах — переводим на оператора как раньше
        await transfer_to_operator(update, context, "Автоматическое переключение по ключевым словам")
        return

    # Проверяем лимиты
    if user_id not in user_limits:
        user_limits[user_id] = 0

    # 🔹 Сначала ищем товар, мастер-класс или набор
    product = find_product(text)
    masterclass = find_masterclass(text)
    set_item = find_set(text)
    
    found_item = product or masterclass or set_item
    
    if found_item:
        item_type = "товар" if product else ("мастер-класс" if masterclass else "набор")
        logger.info(f"Найден {item_type}: {found_item['title']}")
        
        # Формируем детальную информацию
        if product:
            # Информация о товаре
            msg = f"🕯️ **{product['title']}**\n\n"
            msg += f"{product['description']}\n\n"
            msg += f"💰 **Ціна:** {product['price']} грн"
            
            if product.get('discount', 0) > 0:
                discount_price = product['price'] * (100 - product['discount']) / 100
                msg += f" ~~(знижка {product['discount']}%: {discount_price:.0f} грн)~~"
            
            if product.get('specs'):
                msg += f"\n📋 **Характеристики:** {', '.join(product['specs'])}"
                
        elif masterclass:
            # Информация о мастер-классе
            msg = f"🎓 **{masterclass['title']}**\n\n"
            msg += f"{masterclass['description']}\n\n"
            msg += f"💰 **Ціна:** {masterclass['price']} грн\n"
            msg += f"⏱️ **Тривалість:** {masterclass.get('duration', 'Не вказано')}\n"
            msg += f"📊 **Рівень:** {masterclass.get('level', 'Не вказан')}"
            
            if masterclass.get('video_url'):
                msg += f"\n🎥 **Відео:** {masterclass['video_url']}"
                
        elif set_item:
            # Информация о наборе
            msg = f"🧩 **{set_item['title']}**\n\n"
            msg += f"{set_item['description']}\n\n"
            msg += f"💰 **Ціна:** {set_item['price']} грн"
            
            if set_item.get('discount', 0) > 0:
                discount_price = set_item['price'] * (100 - set_item['discount']) / 100
                msg += f" ~~(знижка {set_item['discount']}%: {discount_price:.0f} грн)~~"
            
            if set_item.get('items'):
                msg += f"\n📦 **Склад набору:** {len(set_item['items'])} предметів"
                items_list = []
                for item in set_item['items'][:5]:  # Показываем первые 5 предметов
                    item_title = item.get('title', 'Предмет')
                    item_qty = item.get('qty', 1)
                    items_list.append(f"• {item_title} × {item_qty}")
                if items_list:
                    msg += f"\n{chr(10).join(items_list)}"
                if len(set_item['items']) > 5:
                    msg += f"\n• ... та ще {len(set_item['items']) - 5} предметів"
            
        # Добавляем кнопку для связи с оператором
        keyboard = [[operator_button_for_message(update.message, user_id)]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(msg, reply_markup=reply_markup, parse_mode='Markdown', **get_thread_kwargs(update.message))
        return

    # 🔹 Если товар не найден → обращаемся к Gemini (если лимит не исчерпан)
    if user_limits[user_id] >= MAX_MESSAGES_PER_DAY:
        logger.warning(f"Пользователь {user_id} превысил лимит сообщений")
        await update.message.reply_text(
            "❌ Вы достигли лимита обращений к ИИ на сегодня.\n\n"
            "🔄 Хотите связаться с живым оператором?",
            reply_markup=InlineKeyboardMarkup([[operator_button_for_message(update.message, user_id)]])
        , **get_thread_kwargs(update.message))
        return

    user_limits[user_id] += 1
    logger.info(f"Отправляем запрос к Gemini API для пользователя {user_id}")
    
    try:
        ai_answer = ask_gemini(text)
        logger.info(f"Получен ответ от Gemini API")
        
        # Добавляем кнопку для связи с оператором к ответу ИИ
        keyboard = [[operator_button_for_message(update.message, user_id)]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(ai_answer, reply_markup=reply_markup, **get_thread_kwargs(update.message))
        
    except Exception as e:
        logger.error(f"Ошибка при обращении к Gemini API: {e}")
        await update.message.reply_text(
            "⚠️ Произошла ошибка при обработке запроса.\n\n"
            "🔄 Хотите связаться с живым оператором?",
            reply_markup=InlineKeyboardMarkup([[operator_button_for_message(update.message, user_id)]])
        , **get_thread_kwargs(update.message))

async def handle_contact_operator_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обрабатывает нажатие кнопки 'Связаться с оператором'"""
    query = update.callback_query
    await query.answer()
    
    # Извлекаем user_id из callback_data
    user_id = int(query.data.split('_')[-1])
    
    # Переключаем на оператора
    fake_update = type('obj', (object,), {
        'effective_user': query.from_user,
        'message': query.message
    })
    
    await transfer_to_operator(fake_update, context, "Пользователь нажал кнопку 'Связаться с оператором'")

async def handle_accept_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обрабатывает принятие заявки оператором"""
    query = update.callback_query
    await query.answer()
    
    if not has_operator_privilege(update):
        await query.answer("❌ У вас нет прав", show_alert=True)
        return
    
    # Извлекаем user_id из callback_data
    user_id = int(query.data.split('_')[-1])
    
    if user_id in active_conversations:
        active_conversations[user_id]["accepted"] = True
        
        # Уведомляем пользователя
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text="✅ **Оператор прийняв вашу заявку!**\n\n"
                     "👨‍💼 Зараз з вами буде спілкуватися живий оператор.\n"
                     "💬 Можете ставити будь-які питання!",
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить пользователя {user_id}: {e}")
        
        # Обновляем сообщение оператора
        new_text = query.message.text + "\n\n✅ **ЗАЯВКА ПРИНЯТА**"
        keyboard = [[InlineKeyboardButton("📋 Завершить чат", callback_data=f"end_chat_{user_id}")]]
        
        await query.edit_message_text(
            text=new_text,
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        
        logger.info(f"Оператор принял заявку от пользователя {user_id}")
    else:
        await query.answer("❌ Заявка не найдена", show_alert=True)

async def handle_decline_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обрабатывает отклонение заявки оператором"""
    query = update.callback_query
    await query.answer()
    
    if update.effective_user.id != OPERATOR_ID:
        await query.answer("❌ У вас нет прав", show_alert=True)
        return
    
    # Извлекаем user_id из callback_data
    user_id = int(query.data.split('_')[-1])
    
    if user_id in active_conversations:
        # Удаляем из активных разговоров
        del active_conversations[user_id]
        
        # Уведомляем пользователя
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text="😔 **На жаль, оператор зараз недоступний.**\n\n"
                     "🤖 Але я готовий допомогти вам як ІІ-консультант!\n"
                     "💬 Ставте питання про наші свічки - я знаю все про наш асортимент!",
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить пользователя {user_id}: {e}")
        
        # Обновляем сообщение оператора
        new_text = query.message.text + "\n\n❌ **ЗАЯВКА ОТКЛОНЕНА**"
        
        await query.edit_message_text(
            text=new_text,
            parse_mode='Markdown'
        )
        
        logger.info(f"Оператор отклонил заявку от пользователя {user_id}")
    else:
        await query.answer("❌ Заявка не найдена", show_alert=True)

async def handle_end_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обрабатывает завершение чата оператором через кнопку"""
    query = update.callback_query
    await query.answer()
    
    if update.effective_user.id != OPERATOR_ID:
        await query.answer("❌ У вас нет прав", show_alert=True)
        return
    
    # Извлекаем user_id из callback_data
    user_id = int(query.data.split('_')[-1])
    
    if user_id in active_conversations:
        del active_conversations[user_id]
        
        # Уведомляем пользователя
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text="✅ **Консультація завершена!**\n\n"
                     "🙏 Дякуємо за звернення! Якщо у вас виникнуть ще питання, "
                     "я знову готовий допомогти вам як ІІ-консультант. 🤖\n\n"
                     "💫 Будемо раді бачити вас знову!",
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить пользователя {user_id}: {e}")
        
        # Обновляем сообщение оператора
        new_text = query.message.text + "\n\n🏁 **ЧАТ ЗАВЕРШЕН**"
        
        await query.edit_message_text(
            text=new_text,
            parse_mode='Markdown'
        )
        
        logger.info(f"Оператор завершил чат с пользователем {user_id}")
    else:
        await query.answer("❌ Активный чат не найден", show_alert=True)

async def end_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда для оператора - завершить разговор с пользователем"""
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ У вас нет прав для выполнения этой команды.")
        return
    
    # Получаем ID пользователя из команды
    try:
        args = context.args
        if not args:
            await update.message.reply_text(
                "📝 Использование: /end <user_id>\n"
                "Пример: /end 123456789"
            )
            return
            
        user_id = int(args[0])
        
        if user_id in active_conversations:
            del active_conversations[user_id]
            
            # Уведомляем пользователя
            try:
                await context.bot.send_message(
                    chat_id=user_id,
                    text="✅ Консультація завершена!\n\n"
                         "Дякуємо за звернення! Якщо у вас виникнуть ще питання, "
                         "я знову готовий допомогти вам як ІІ-консультант. 🤖"
                )
            except Exception as e:
                logger.error(f"Не удалось уведомить пользователя {user_id}: {e}")
            
            await update.message.reply_text(f"✅ Разговор с пользователем {user_id} завершен.")
            logger.info(f"Оператор завершил разговор с пользователем {user_id}")
        else:
            await update.message.reply_text(f"❌ Активный разговор с пользователем {user_id} не найден.")
            
    except ValueError:
        await update.message.reply_text("❌ Неверный формат ID пользователя.")
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка: {e}")

async def list_active_conversations(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда для оператора - показать активные разговоры"""
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ У вас нет прав для выполнения этой команды.")
        return
    
    if not active_conversations:
        await update.message.reply_text("📭 Нет активных разговоров с пользователями.")
        return
    
    msg = "👥 **Активные разговоры:**\n\n"
    for user_id, conv_data in active_conversations.items():
        user_info = conv_data.get('user_info', {})
        name = user_info.get('name', 'Неизвестно')
        username = user_info.get('username', 'не указан')
        
        msg += f"• **{name}** (ID: `{user_id}`)\n"
        msg += f"  Username: @{username}\n"
        msg += f"  Статус: {'🟢 С оператором' if conv_data.get('with_operator') else '🟡 Ожидание'}\n\n"
    
    msg += "\n💡 Для завершения разговора используйте: `/end <user_id>`"
    
    await update.message.reply_text(msg, parse_mode='Markdown')

# ======================
# 🔹 Admin utilities
# ======================

async def whoami(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать ваш user_id и текущий chat_id для быстрой диагностики."""
    uid = update.effective_user.id if update.effective_user else None
    cid = update.effective_chat.id if update.effective_chat else None
    ctype = update.effective_chat.type if update.effective_chat else None
    await update.message.reply_text(
        f"👤 user_id: `{uid}`\n💬 chat_id: `{cid}`\n📦 chat_type: `{ctype}`\n",
        parse_mode='Markdown'
    )

async def mod_on(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global MODERATION_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ У вас нет прав для этой команды.")
        return
    MODERATION_ENABLED = True
    await update.message.reply_text("✅ Модерация включена")

async def mod_off(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global MODERATION_ENABLED
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ У вас нет прав для этой команды.")
        return
    MODERATION_ENABLED = False
    await update.message.reply_text("⏸️ Модерация выключена")

async def mod_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Статус модерации:\n"
        f"- enabled: {MODERATION_ENABLED}\n"
        f"- bad_words: {', '.join(sorted(moderation_config['bad_words']))}\n"
        f"- block_links: {moderation_config['block_links']}\n"
        f"- max_msgs_per_10s: {moderation_config['max_msgs_per_10s']}\n"
        f"- default_mute_minutes: {moderation_config['default_mute_minutes']}\n"
        f"- escalate_threshold: {moderation_config['escalate_threshold']}"
    )

async def mod_rules(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ У вас нет прав для этой команды.")
        return
    try:
        args = context.args
        if not args:
            await update.message.reply_text(
                "Использование:\n"
                "/mod_rules add_word <слово>\n"
                "/mod_rules del_word <слово>\n"
                "/mod_rules links <on|off>\n"
                "/mod_rules mute <минуты>\n"
                "/mod_rules flood <N_за_10с>\n"
                "/mod_rules escalate <кол-во_нарушений_до_бана>"
            )
            return
        cmd = args[0]
        if cmd == "add_word" and len(args) >= 2:
            moderation_config["bad_words"].add(args[1].lower())
            await update.message.reply_text("✅ Добавлено")
        elif cmd == "del_word" and len(args) >= 2:
            moderation_config["bad_words"].discard(args[1].lower())
            await update.message.reply_text("🗑️ Удалено")
        elif cmd == "links" and len(args) >= 2:
            moderation_config["block_links"] = args[1].lower() == "on"
            await update.message.reply_text(f"✅ block_links = {moderation_config['block_links']}")
        elif cmd == "mute" and len(args) >= 2:
            moderation_config["default_mute_minutes"] = int(args[1])
            await update.message.reply_text("✅ Изменено")
        elif cmd == "flood" and len(args) >= 2:
            moderation_config["max_msgs_per_10s"] = int(args[1])
            await update.message.reply_text("✅ Изменено")
        elif cmd == "escalate" and len(args) >= 2:
            moderation_config["escalate_threshold"] = int(args[1])
            await update.message.reply_text("✅ Изменено")
        else:
            await update.message.reply_text("❌ Неверные аргументы. /mod_rules для справки")
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка: {e}")

async def setadminchat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Установить ADMIN_CHAT_ID. Только для оператора. /setadminchat <chat_id> или без аргумента — взять текущий chat_id."""
    global ADMIN_CHAT_ID
    args = context.args
    try:
        # Режим 1: без аргумента в группе/супергруппе и ADMIN_CHAT_ID еще не задан — разрешаем без привилегий
        if (not args) and (ADMIN_CHAT_ID is None) and update.effective_chat and update.effective_chat.type in ("group", "supergroup"):
            ADMIN_CHAT_ID = update.effective_chat.id
            await update.message.reply_text(f"✅ ADMIN_CHAT_ID установлен: `{ADMIN_CHAT_ID}`", parse_mode='Markdown')
            return
        # Режим 2: явная установка по ID — требуется привилегия оператора/админ-чата
        if not has_operator_privilege(update):
            await update.message.reply_text("❌ У вас нет прав для этой команды.")
            return
        if args:
            ADMIN_CHAT_ID = int(args[0])
        else:
            ADMIN_CHAT_ID = update.effective_chat.id
        await update.message.reply_text(f"✅ ADMIN_CHAT_ID установлен: `{ADMIN_CHAT_ID}`", parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка: {e}")

async def getadminchat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать текущий ADMIN_CHAT_ID."""
    val = ADMIN_CHAT_ID if ADMIN_CHAT_ID is not None else 'None'
    await update.message.reply_text(f"🔧 ADMIN_CHAT_ID: `{val}`", parse_mode='Markdown')

async def chatid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать текущий chat_id (без привилегий)."""
    cid = update.effective_chat.id if update.effective_chat else None
    ctype = update.effective_chat.type if update.effective_chat else None
    await update.message.reply_text(f"💬 chat_id: `{cid}`\n📦 chat_type: `{ctype}`", parse_mode='Markdown')

async def setoperator(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Изменить OPERATOR_ID на лету. Только для текущего оператора."""
    global OPERATOR_ID
    if not has_operator_privilege(update):
        await update.message.reply_text("❌ У вас нет прав для этой команды.")
        return
    try:
        new_id = int(context.args[0])
        OPERATOR_ID = new_id
        await update.message.reply_text(f"✅ OPERATOR_ID изменен на `{OPERATOR_ID}`", parse_mode='Markdown')
    except Exception:
        await update.message.reply_text("📝 Использование: /setoperator <user_id>")

# ======================
# 🔹 MAIN
# ======================

def main():
    logger.info("🚀 Запуск бота поддержки...")
    
    try:
        app = Application.builder().token("8446043978:AAHKgp_ppOBkmSJPILApaS0BqHP6vlzwQjs").build()

        app.add_handler(CommandHandler("start", start))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
        
        # Команды для оператора
        app.add_handler(CommandHandler("end", end_conversation))
        app.add_handler(CommandHandler("list", list_active_conversations))
        # Admin utilities
        app.add_handler(CommandHandler("whoami", whoami))
        app.add_handler(CommandHandler("chatid", chatid))
        app.add_handler(CommandHandler("setadminchat", setadminchat))
        app.add_handler(CommandHandler("getadminchat", getadminchat))
        app.add_handler(CommandHandler("debug_priv", debug_priv))
        app.add_handler(CommandHandler("setoperator", setoperator))
        # Channel scheduler & management
        app.add_handler(CommandHandler("setchannel", cmd_setchannel))
        app.add_handler(CommandHandler("addchannel", cmd_addchannel))
        app.add_handler(CommandHandler("rmchannel", cmd_rmchannel))
        app.add_handler(CommandHandler("listchannels", cmd_listchannels))
        app.add_handler(CommandHandler("scheduler_on", cmd_scheduler_on))
        app.add_handler(CommandHandler("scheduler_off", cmd_scheduler_off))
        app.add_handler(CommandHandler("scheduler_status", cmd_scheduler_status))
        app.add_handler(CommandHandler("set_post_times", cmd_set_post_times))
        app.add_handler(CommandHandler("set_posts_per_day", cmd_set_posts_per_day))
        app.add_handler(CommandHandler("post_now", cmd_post_now))
        app.add_handler(CommandHandler("set_mix", cmd_set_mix))
        app.add_handler(CommandHandler("set_poll_prob", cmd_set_poll_prob))
        app.add_handler(CommandHandler("set_review_prob", cmd_set_review_prob))
        app.add_handler(CommandHandler("review_on", cmd_review_on))
        app.add_handler(CommandHandler("review_off", cmd_review_off))
        app.add_handler(CommandHandler("post_review_now", post_review_now))
        app.add_handler(CommandHandler("hourly_on", cmd_hourly_on))
        app.add_handler(CommandHandler("hourly_off", cmd_hourly_off))
        app.add_handler(CommandHandler("set_require_ai", cmd_set_require_ai))
        app.add_handler(CommandHandler("post_poll_now", post_poll_now))
        app.add_handler(CommandHandler("set_promo_prob", cmd_set_promo_prob))
        app.add_handler(CommandHandler("promo_on", promo_on))
        app.add_handler(CommandHandler("promo_off", promo_off))
        app.add_handler(CommandHandler("post_promo_now", post_promo_now))
        app.add_handler(ChatMemberHandler(my_chat_member_update, chat_member_types=["my_chat_member"]))
        # Moderation commands
        app.add_handler(CommandHandler("mod_on", mod_on))
        app.add_handler(CommandHandler("mod_off", mod_off))
        app.add_handler(CommandHandler("mod_status", mod_status))
        app.add_handler(CommandHandler("mod_rules", mod_rules))
        # Real moderation actions
        app.add_handler(CommandHandler("ban", cmd_ban))
        app.add_handler(CommandHandler("unban", cmd_unban))
        app.add_handler(CommandHandler("mute", cmd_mute))
        app.add_handler(CommandHandler("unmute", cmd_unmute))
        app.add_handler(CommandHandler("self_mute", cmd_self_mute))
        app.add_handler(CommandHandler("self_ban", cmd_self_ban))
        
        # Добавляем обработчики для кнопок
        from telegram.ext import CallbackQueryHandler
        app.add_handler(CallbackQueryHandler(handle_contact_operator_callback, pattern=r'^contact_operator_\d+$'))
        app.add_handler(CallbackQueryHandler(handle_accept_request, pattern=r'^accept_request_\d+$'))
        app.add_handler(CallbackQueryHandler(handle_decline_request, pattern=r'^decline_request_\d+$'))
        app.add_handler(CallbackQueryHandler(handle_end_chat, pattern=r'^end_chat_\d+$'))

        # Автонастройка планировщика и мгновенный пост при старте (опционально)
        if app.job_queue is None:
            logging.error("JobQueue is not available. To enable scheduling, run: pip install \"python-telegram-bot[job-queue]\"")
        else:
            if SCHEDULER_ENABLED:
                if HOURLY_MODE:
                    schedule_hourly(app)
                else:
                    schedule_daily_polls(app)
            if POST_ON_START:
                app.job_queue.run_once(post_scheduled_content, when=0, name="post_on_start")

        logger.info("✅ Бот поддержки успешно запущен и готов к работе!")
        logger.info("📡 Ожидание сообщений...")
        
        app.run_polling()
        
    except Exception as e:
        logger.error(f"❌ Ошибка при запуске бота: {e}")
        raise

if __name__ == "__main__":
    main()
