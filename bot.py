import os
import json
from html2image import Html2Image
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton, InputFile, KeyboardButton, ReplyKeyboardMarkup, InputMediaPhoto
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    MessageHandler, filters, ContextTypes, ConversationHandler
)
from flask import Flask, jsonify, request, send_from_directory
import requests
try:
    from flask_cors import CORS
except ImportError:
    # Fallback to a no-op if flask_cors is not installed so the app doesn't crash
    def CORS(*args, **kwargs):
        return None
import threading
import time
import re

# Етапи діалогу для додавання
TITLE, CATEGORY, DESCRIPTION, PRICE, DISCOUNT, SPECS, REVIEWS, PHOTOS = range(8)
EDIT_SELECT, EDIT_FIELD, EDIT_VALUE, EDIT_PHOTO = range(100, 104)
AWAITING_ADMIN_ID = "AWAITING_ADMIN_ID"

# States for Sets (Bundles) management
SET_TITLE, SET_DESC, SET_PRICE, SET_DISCOUNT, SET_ITEMS, SET_PHOTOS = range(300, 306)
SET_EDIT_SELECT, SET_EDIT_FIELD, SET_EDIT_VALUE, SET_EDIT_PHOTO = range(306, 310)
# New granular states for item-by-item adding inside a set
SET_ITEMS_MENU, SET_ITEM_TITLE, SET_ITEM_QTY, SET_ITEM_NOTE, SET_ITEM_PHOTO = range(310, 315)

# Тимчасове сховище
temp_product = {}
products_file = "products.json"
image_folder = "images"
ADMINS_FILE = "admins.json"
MASTERCLASSES_FILE = "masterclasses.json"
ORDERS_FILE = "orders.json"
SETS_FILE = "sets.json"

TOKEN = "8049436425:AAFxSKhjA5Hu3TWePEODYJCaunENrdV9zVA"  # Новый токен бота
BOT_SECRET = os.getenv('BOT_SECRET', 'change-bot-secret')

# Update the ADMINS loading and initialization
if os.path.exists(ADMINS_FILE):
    with open(ADMINS_FILE, 'r', encoding='utf-8') as f:
        ADMINS = json.load(f)
        # Convert old format (list of ints) to new format (list of dicts)
        if ADMINS and isinstance(ADMINS[0], int):
            ADMINS = [{"id": admin_id, "name": f"Admin {i+1}"} for i, admin_id in enumerate(ADMINS)]
            with open(ADMINS_FILE, 'w', encoding='utf-8') as fw:
                json.dump(ADMINS, fw, ensure_ascii=False, indent=2)
else:
    # Default admin with ID and name
    ADMINS = [{"id": 1617813030, "name": "Головний адміністратор"}]
    with open(ADMINS_FILE, 'w', encoding='utf-8') as f:
        json.dump(ADMINS, f, ensure_ascii=False, indent=2)

# Ensure the script.js admin ID is always in the admin list
SCRIPT_JS_ADMIN_ID = 702004730
if not any(admin["id"] == SCRIPT_JS_ADMIN_ID for admin in ADMINS):
    ADMINS.append({"id": SCRIPT_JS_ADMIN_ID, "name": "Веб-адміністратор"})
    # Save the updated admin list
    with open(ADMINS_FILE, 'w', encoding='utf-8') as f:
        json.dump(ADMINS, f, ensure_ascii=False, indent=2)

def is_admin(user_id: int) -> bool:
    """Check if a user is an admin"""
    return any(admin["id"] == user_id for admin in ADMINS)

def get_admin_name(user_id: int) -> str:
    """Get admin's name by ID"""
    for admin in ADMINS:
        if admin["id"] == user_id:
            return admin.get("name", str(user_id))
    return str(user_id)

def load_orders():
    try:
        if os.path.exists(ORDERS_FILE):
            with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Failed to load orders: {e}")
    return {}

# ===================== НАБОРИ (SETS) =====================

def load_sets():
    try:
        if os.path.exists(SETS_FILE):
            with open(SETS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception as e:
        print(f"Failed to load sets: {e}")
    return []

# ---------- Helpers to render detailed order info ----------
def format_order_items(order: dict) -> str:
    """Build a human-readable items breakdown.
    Supports normal items, custom candle fields, and set composition if provided in order dict.
    Expected order structure (flexible):
      order['items'] = [
        {
          'title': str,
          'quantity': int,
          'price': number,            # per unit or total
          'total': number,            # optional
          'material': str, 'color': str, 'volume': str, 'aroma': str, 'notes': str,  # for custom candle
          'isSet': bool, 'setItems': [ {'title': str, 'qty': int, 'note': str} ]     # for sets
        }
      ]
    We render gracefully if some fields are missing.
    """
    items = order.get('items') or order.get('cart') or []
    # Fallback: attempt to parse from raw text if not present
    if (not isinstance(items, list) or not items) and order.get('raw'):
        parsed = extract_order_summary(order.get('raw') or '')
        items = parsed.get('items', [])
    if not isinstance(items, list) or not items:
        return ""
    lines = ["\n🛒 Склад замовлення:"]
    for idx, it in enumerate(items, 1):
        title = str(it.get('title') or it.get('name') or f"Товар {idx}")
        qty = it.get('quantity') or it.get('qty') or 1
        # totals
        total = it.get('total')
        price = it.get('price')
        if total is None and isinstance(price, (int, float)):
            try:
                total = price * (qty or 1)
            except Exception:
                total = None
        price_part = f" — ₴{total:.0f}" if isinstance(total, (int, float)) else ""
        lines.append(f"• {title} × {qty}{price_part}")

        # Custom candle details
        if 'Свічка під замовлення' in title or (it.get('material') or it.get('color') or it.get('volume') or it.get('aroma') or it.get('notes')):
            sub = []
            if it.get('material'): sub.append(f"Матеріал: {it.get('material')}")
            if it.get('color'):    sub.append(f"Колір: {it.get('color')}")
            if it.get('volume'):   sub.append(f"Об'єм: {it.get('volume')}")
            if it.get('aroma'):    sub.append(f"Аромат: {it.get('aroma')}")
            if it.get('notes'):    sub.append(f"Побажання: {it.get('notes')}")
            if sub:
                for s in sub:
                    lines.append(f"   · {s}")

        # Set composition
        set_items = it.get('setItems') or it.get('items') if it.get('isSet') else it.get('setItems')
        if isinstance(set_items, list) and set_items:
            lines.append("   · Склад набору:")
            for si in set_items:
                s_title = si.get('title') or si.get('name') or 'Позиція'
                s_qty = si.get('qty') or si.get('quantity') or 1
                s_note = si.get('note') or ''
                note_part = f" — {s_note}" if s_note else ''
                lines.append(f"     - {s_title} × {s_qty}{note_part}")
    return "\n".join(lines)

def save_sets(sets: list):
    try:
        with open(SETS_FILE, 'w', encoding='utf-8') as f:
            json.dump(sets, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Failed to save sets: {e}")

def save_orders(orders: dict):
    try:
        with open(ORDERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(orders, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Failed to save orders: {e}")

def notify_admins(context, message: str):
    """Send a message to all admins"""
    for admin in ADMINS:
        try:
            context.bot.send_message(
                chat_id=admin["id"],
                text=message,
                parse_mode='Markdown'
            )
        except Exception as e:
            print(f"Failed to send notification to admin {admin['id']}: {e}")

# ===================== ЗАМОВЛЕННЯ =====================

def normalize_status(status: str) -> str:
    """Map legacy English statuses to Ukrainian. Returns Ukrainian status."""
    if not status:
        return status
    m = {
        'paid': 'оплачено',
        'unpaid': 'скасовано',
        'cancelled': 'скасовано',
        'canceled': 'скасовано',
        'manufacturing': 'виготовляється',
        'shipped': 'в дорозі',
        'completed': 'виконано',
        'new': 'нове',
    }
    return m.get(status, status)

# Human-readable datetime from Unix timestamp
def format_datetime(ts: int) -> str:
    try:
        return time.strftime('%Y-%m-%d %H:%M', time.localtime(int(ts)))
    except Exception:
        return ''

def extract_order_summary(text: str) -> dict:
    data = {"raw": text}
    try:
        lines = text.splitlines()
        # Find total line
        total_line = next((l for l in lines if 'Разом' in l or 'Разом:' in l), '')
        if total_line:
            import re
            m = re.search(r"([0-9]+[\.,]?[0-9]*)", total_line)
            if m:
                data['total'] = float(m.group(1).replace(',', '.'))
        # Parse final total (after stars/discount) if present
        final_line = next((l for l in lines if 'До сплати' in l or 'До оплати' in l or 'Итого к оплате' in l), '')
        if final_line:
            try:
                import re as _re
                m2 = _re.search(r"([0-9]+[\.,]?[0-9]*)", final_line)
                if m2:
                    data['final_total'] = float(m2.group(1).replace(',', '.'))
            except Exception:
                pass
        # Parse stars used (discount by stars)
        # Support variants: "Знижка зірками", "Знижка зішками" (typo), "Використано зірок", "⭐"
        for l in lines:
            low = l.lower()
            if ('знижка' in low and ('зір' in low or 'зiр' in low or 'зишк' in low)) or ('використано' in low and ('зір' in low or 'зiр' in low)) or ('⭐' in l):
                try:
                    import re as _re2
                    m3 = _re2.search(r"([0-9]+)", l)
                    if m3:
                        data['stars_used'] = int(m3.group(1))
                        break
                except Exception:
                    pass
        # Customer name
        name_line = next((l for l in lines if 'ПІБ' in l), '')
        if name_line:
            data['customer'] = name_line.split(':', 1)[-1].strip()
        # City and delivery
        city_line = next((l for l in lines if 'Місто' in l), '')
        if city_line:
            data['city'] = city_line.split(':', 1)[-1].strip()
        post_line = next((l for l in lines if 'Пошта' in l), '')
        if post_line:
            data['delivery'] = post_line.split(':', 1)[-1].strip()

        # Heuristic: parse item lines like
        # "• Назва × 2 = ₴450" or "Назва x2" before the total line
        items = []
        import re
        for l in lines:
            if 'Разом' in l:
                break
            m = re.search(r"^(?:[\-•\*]\s*)?(?P<title>[^=\n]+?)\s*[x×]\s*(?P<qty>\d+)(?:\s*[=]\s*[₴]?(?P<sum>[0-9\.,]+))?", l.strip(), re.IGNORECASE)
            if m:
                title = m.group('title').strip()
                qty = int(m.group('qty'))
                sum_str = m.group('sum')
                total = float(sum_str.replace(',', '.')) if sum_str else None
                items.append({"title": title, "quantity": qty, "total": total})
        if items:
            data['items'] = items
    except Exception as e:
        print(f"extract_order_summary error: {e}")
    return data

async def orders_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id):
        await (update.callback_query.message if update.callback_query else update.message).reply_text("❌ Немає доступу")
        return
    keyboard = [
        [InlineKeyboardButton("📄 Активні замовлення", callback_data='orders_list')],
        [InlineKeyboardButton("🔙 Назад", callback_data='admin_panel')]
    ]
    text = "📋 Меню замовлень"
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.edit_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
    else:
        await update.message.reply_text(text, reply_markup=InlineKeyboardMarkup(keyboard))

async def orders_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.callback_query:
        await update.callback_query.answer()
        msg = update.callback_query.message
    else:
        msg = update.message
    if not is_admin(update.effective_user.id):
        await msg.reply_text("❌ Немає доступу")
        return
    orders = load_orders()
    # Normalize legacy statuses to Ukrainian and persist if needed
    changed = False
    for o in orders.values():
        st = o.get('status')
        uk = normalize_status(st)
        if uk != st:
            o['status'] = uk
            changed = True
    if changed:
        save_orders(orders)
    # Show only truly active orders (exclude completed and cancelled equivalents)
    active = [o for o in orders.values() if o.get('status') not in ('виконано', 'скасовано')]
    if not active:
        await msg.edit_text("Наразі немає активних замовлень.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Назад", callback_data='orders_menu')]]))
        return
    buttons = []
    for o in sorted(active, key=lambda x: x.get('created_at', 0), reverse=True)[:50]:
        # Prefer final_total (after stars) if available; else compute if possible
        tot = o.get('total')
        stars = o.get('stars_used') or 0
        final_tot = o.get('final_total')
        if final_tot is None and isinstance(tot, (int, float)) and isinstance(stars, (int, float)):
            try:
                final_tot = max(0, float(tot) - float(stars))
            except Exception:
                final_tot = tot
        price_str = f"₴{final_tot if final_tot is not None else tot}"
        title = f"#{o.get('id','')} • {o.get('customer','Клієнт')} • {price_str} • {o.get('status','нове')}"
        buttons.append([InlineKeyboardButton(title, callback_data=f"order_view:{o.get('id')}")])
    buttons.append([InlineKeyboardButton("🔙 Назад", callback_data='orders_menu')])
    await msg.edit_text("Активні замовлення:", reply_markup=InlineKeyboardMarkup(buttons))

async def order_view(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    order_id = query.data.split(":",1)[1]
    orders = load_orders()
    o = orders.get(order_id)
    if not o:
        await query.message.edit_text("Замовлення не знайдене.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Назад", callback_data='orders_list')]]))
        return
    # Ensure created_at exists
    if not o.get('created_at'):
        o['created_at'] = int(time.time())
        save_orders(orders)
    # Enrich order items from raw/summary if absent
    if (not o.get('items')) and (o.get('summary') or o.get('raw')):
        parsed = o.get('summary') or extract_order_summary(o.get('raw') or '')
        if isinstance(parsed, dict) and parsed.get('items'):
            o['items'] = parsed.get('items')
            save_orders(orders)
    details = format_order_items(o)
    if not details:
        # Fallback: try to parse items from the visible message text
        raw_text = (query.message.text or '')
        parsed = extract_order_summary(raw_text)
        details = format_order_items(parsed)
    dt = format_datetime(o.get('created_at'))
    # Compute display amounts
    total = o.get('total')
    stars_used = o.get('stars_used') or 0
    final_total = o.get('final_total')
    if final_total is None and isinstance(total, (int, float)) and isinstance(stars_used, (int, float)):
        try:
            final_total = max(0, float(total) - float(stars_used))
        except Exception:
            final_total = total
    # Build amount section
    amounts_lines = []
    if isinstance(total, (int, float)):
        amounts_lines.append(f"Сума (без зірок): ₴{total}")
    if isinstance(stars_used, (int, float)) and stars_used:
        amounts_lines.append(f"Використано зірок: {int(stars_used)} ⭐ (−₴{int(stars_used)})")
    if final_total is not None:
        amounts_lines.append(f"До сплати: ₴{final_total}")
    amounts_text = ("\n".join(amounts_lines)) if amounts_lines else f"Сума: ₴{o.get('total','')}"
    text = (
        f"🧾 Замовлення #{o.get('id')}\n"
        f"Статус: {o.get('status')}\n"
        f"Клієнт: {o.get('customer','')}\n"
        f"Дата: {dt}\n"
        f"{amounts_text}" + (details or '') + "\n\n"
        "Натисніть для зміни статусу або завершення."
    )
    kb = [
        [InlineKeyboardButton("🛠 Виготовляється", callback_data=f"order_status:{order_id}:manufacturing")],
        [InlineKeyboardButton("📦 В дорозі", callback_data=f"order_status:{order_id}:shipped")],
        [InlineKeyboardButton("✅ Виконано", callback_data=f"order_status:{order_id}:completed")],
        [InlineKeyboardButton("🔙 До списку", callback_data='orders_list')]
    ]
    await query.message.edit_text(text, reply_markup=InlineKeyboardMarkup(kb))

async def order_set_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    _, order_id, status = query.data.split(":",2)
    orders = load_orders()
    o = orders.get(order_id)
    if not o:
        await query.message.reply_text("❌ Замовлення не знайдене")
        return
    # Map callback token to Ukrainian status
    token_to_uk = {
        'manufacturing': 'виготовляється',
        'shipped': 'в дорозі',
        'completed': 'виконано',
    }
    uk_status = token_to_uk.get(status, normalize_status(status))
    o['status'] = uk_status
    o.setdefault('history', []).append({"ts": int(time.time()), "status": uk_status, "by": update.effective_user.id})
    save_orders(orders)
    if status == 'completed':
        await query.message.reply_text(f"✅ Замовлення #{order_id} позначено як виконане.")
        # Return to list
        await orders_list(update, context)
    else:
        await order_view(update, context)

async def order_mark_paid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    order_id = query.data.split(":",1)[1]
    orders = load_orders()
    o = orders.get(order_id)
    if not o:
        # Create order from original message text
        msg_text = query.message.text or ''
        summary = extract_order_summary(msg_text)
        o = {
            'id': order_id,
            'status': 'оплачено',
            'created_at': int(time.time()),
            'summary': summary,
            'customer': summary.get('customer',''),
            'total': summary.get('total',''),
            'final_total': summary.get('final_total'),
            'stars_used': summary.get('stars_used'),
            'raw': msg_text,
            'items': summary.get('items', []),
        }
        orders[order_id] = o
    else:
        o['status'] = 'оплачено'
        # Try to enrich with stars/final if missing
        if o.get('final_total') is None or o.get('stars_used') is None:
            msg_text = query.message.text or ''
            summary = extract_order_summary(msg_text)
            if o.get('final_total') is None and summary.get('final_total') is not None:
                o['final_total'] = summary.get('final_total')
            if o.get('stars_used') is None and summary.get('stars_used') is not None:
                o['stars_used'] = summary.get('stars_used')
    o.setdefault('history', []).append({"ts": int(time.time()), "status": 'оплачено', "by": update.effective_user.id})
    save_orders(orders)
    # Try to confirm pending action if PID is present in the message text (to award stars / grant access)
    pid_confirmed = False
    try:
        msg_text = query.message.text or ''
        m = re.search(r"PID:\s*([\w\-_.:]+)", msg_text)
        if m:
            pid = m.group(1)
            try:
                resp = requests.post(
                    'http://localhost:3000/api/pending/confirm',
                    headers={'X-Bot-Token': BOT_SECRET, 'Content-Type': 'application/json'},
                    json={'id': pid}, timeout=10
                )
                if resp.ok:
                    # optional: parse resp.json() if needed
                    pid_confirmed = True
                else:
                    # Inform admin about failure but proceed
                    try:
                        await query.message.reply_text(f"❌ Не вдалося підтвердити PID {pid}: {resp.status_code}")
                    except Exception:
                        pass
            except Exception as e:
                try:
                    await query.message.reply_text(f"❌ Помилка підтвердження PID {pid}: {e}")
                except Exception:
                    pass
    except Exception:
        # ignore PID parsing errors
        pass

    # Update message buttons to go to orders
    kb = [[InlineKeyboardButton("📋 Відкрити список замовлень", callback_data='orders_list')]]
    base_text = (query.message.text or '') + "\n\n✅ Помічено як: оплата пройшла."
    if not pid_confirmed:
        # Fallback: try to parse UID and award +10 stars directly via admin endpoint
        try:
            msg_text2 = query.message.text or ''
            mu = re.search(r"UID:\s*(\d+)", msg_text2)
            if mu:
                uid = int(mu.group(1))
                try:
                    resp2 = requests.post(
                        'http://localhost:3000/api/admin/add-stars',
                        headers={'X-Bot-Token': BOT_SECRET, 'Content-Type': 'application/json'},
                        json={'userId': uid, 'stars': 10}, timeout=10
                    )
                    if resp2.ok:
                        base_text += "\n⭐ Бонуси нараховано через UID: +10."
                        pid_confirmed = True
                    else:
                        try:
                            await query.message.reply_text(f"❌ Не вдалося нарахувати зірки UID {uid}: {resp2.status_code}")
                        except Exception:
                            pass
                except Exception as ee:
                    try:
                        await query.message.reply_text(f"❌ Помилка нарахування зірок UID {uid}: {ee}")
                    except Exception:
                        pass
        except Exception:
            pass
        if not pid_confirmed:
            base_text += "\nℹ️ Увага: у повідомленні немає PID або підтвердження не виконано, тому зірки не нараховано. Оформіть нове замовлення на сайті (оновивши сторінку), щоб кнопка мала PID."
    await query.message.edit_text(base_text, reply_markup=InlineKeyboardMarkup(kb))

async def order_mark_unpaid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    order_id = query.data.split(":",1)[1]
    orders = load_orders()
    # If the order exists, remove it permanently. If not, just notify.
    if order_id in orders:
        try:
            # Optional: keep a very lightweight audit trail by printing to logs
            print(f"Order {order_id} marked as unpaid -> deleting from storage")
            del orders[order_id]
            save_orders(orders)
        except Exception as e:
            print(f"Failed to delete order {order_id}: {e}")
    else:
        print(f"order_mark_unpaid: order {order_id} not found; nothing to delete")

    # Update UI and suggest returning to list
    kb = [[InlineKeyboardButton("📋 Відкрити список замовлень", callback_data='orders_list')]]
    await query.message.edit_text((query.message.text or '') + "\n\n⛔ Замовлення скасовано: запис видалено назавжди.", reply_markup=InlineKeyboardMarkup(kb))

async def confirm_pending_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin pressed 'Підтвердити оплату' in Telegram. Confirms pending action on server."""
    query = update.callback_query
    await query.answer()
    try:
        _, pid = query.data.split(":", 1)
    except Exception:
        pid = ''
    if not pid:
        await query.message.reply_text("❌ Некоректний ідентифікатор")
        return
    try:
        resp = requests.post(
            'http://localhost:3000/api/pending/confirm',
            headers={'X-Bot-Token': BOT_SECRET, 'Content-Type': 'application/json'},
            json={'id': pid}, timeout=10
        )
        if resp.ok:
            data = {}
            try:
                data = resp.json() or {}
            except Exception:
                data = {}

            # 1) Создаём/обновляем заказ в локальном списке (для раздела "Активні замовлення")
            # Пытаемся получить orderId от сервера, иначе используем сам PID как id заказа.
            order_id = str(data.get('orderId') or data.get('order_id') or data.get('id') or pid)
            orders = load_orders()

            # Попробуем извлечь данные из текста сообщения (подытог, финальная сумма, звезды, товары...)
            msg_text = query.message.text or ''
            summary = extract_order_summary(msg_text)

            o = orders.get(order_id) or {}
            o['id'] = order_id
            # Если сервер вернул статус — используем, иначе считаем оплаченным
            o['status'] = normalize_status(data.get('status') or 'оплачено')
            o.setdefault('created_at', int(time.time()))
            # Сохраняем краткую выжимку и исходный текст
            if summary:
                o.setdefault('summary', summary)
                # Обновляем полезные поля, если их нет
                if o.get('customer') is None and summary.get('customer'):
                    o['customer'] = summary.get('customer')
                if o.get('total') is None and summary.get('total') is not None:
                    o['total'] = summary.get('total')
                if o.get('final_total') is None and summary.get('final_total') is not None:
                    o['final_total'] = summary.get('final_total')
                if o.get('stars_used') is None and summary.get('stars_used') is not None:
                    o['stars_used'] = summary.get('stars_used')
                if not o.get('items') and summary.get('items'):
                    o['items'] = summary.get('items')
            o['raw'] = msg_text
            o.setdefault('history', []).append({"ts": int(time.time()), "status": o['status'], "by": update.effective_user.id})

            orders[order_id] = o
            save_orders(orders)

            # 2) Обновляем сообщение и даём кнопку перехода к списку заказов
            kb = [[InlineKeyboardButton("📋 Відкрити список замовлень", callback_data='orders_list')]]
            await query.message.edit_text((query.message.text or '') + "\n\n✅ Оплату підтверджено. Замовлення додано до активних.", reply_markup=InlineKeyboardMarkup(kb))
        else:
            await query.message.reply_text(f"❌ Помилка підтвердження: {resp.status_code}")
    except Exception as e:
        await query.message.reply_text(f"❌ Не вдалося підтвердити: {e}")

# ---------------------- КОМАНДИ ----------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    welcome_message = (
        f"👋 Вітаю, {user.first_name}!\n"
        "Я бот для управління товарами.\n"
        "Використовуйте кнопки в меню для навігації."
    )
    
    # Send welcome message to user
    if is_admin(user.id):
        keyboard = [["📦 Меню", "🎓 Управління майстер-класами"], ["🧩 Набори", "📋 Замовлення"], ["👑 Панель адміністратора", "🆔 Мій ID"]]
    else:
        keyboard = [["📦 Меню", "🆔 Мій ID"]]
    await update.message.reply_text(welcome_message, reply_markup=ReplyKeyboardMarkup(
        keyboard, resize_keyboard=True
    ))
    
    # Notify admins about new user
    admin_notification = (
        "🆕 *Новий користувач у боті*\n"
        f"👤 Ім'я: {user.full_name}"
        f"\n🆔 ID: `{user.id}`"
        f"\n📝 Username: @{user.username}" if user.username else ""
    )
    # Send to ALL admins instead of only the first one
    notify_admins(context, admin_notification)

async def send_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if is_admin(user_id):
        keyboard = [
            [KeyboardButton("📦 Меню"), KeyboardButton("🎓 Управління майстер-класами")],
            [KeyboardButton("🧩 Набори"), KeyboardButton("📋 Замовлення")],
            [KeyboardButton("👑 Панель адміністратора"), KeyboardButton("🆔 Мій ID")]
        ]
    else:
        keyboard = [
            [KeyboardButton("📦 Меню"), KeyboardButton("🆔 Мій ID")]
        ]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    if update.message:
        await update.message.reply_text("Оберіть опцію з меню:", reply_markup=reply_markup)
    elif update.callback_query:
        await update.callback_query.message.reply_text("Оберіть опцію з меню:", reply_markup=reply_markup)

async def handle_menu_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("➕ Додати нову", callback_data="add")],
        [InlineKeyboardButton("📋 Мої картки", callback_data="list")],
        [InlineKeyboardButton("🗑 Видалити", callback_data="delete")],
        [InlineKeyboardButton("✏️ Редагувати", callback_data="edit")],
        [InlineKeyboardButton("⭐ Відгуки", callback_data="reviews_menu")]
    ]
    # Show availability control here for admins
    try:
        user_id = update.effective_user.id
        if is_admin(user_id):
            keyboard.append([InlineKeyboardButton("Наявність товарів", callback_data='availability_panel')])
    except Exception:
        pass

    await update.message.reply_text("📦 Меню:", reply_markup=InlineKeyboardMarkup(keyboard))

async def show_sets_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Панель керування наборами (для адмінів)"""
    if not is_admin(update.effective_user.id):
        await (update.callback_query.message if update.callback_query else update.message).reply_text("❌ У вас немає прав доступу до наборів.")
        return
    query = update.callback_query
    if query:
        await query.answer()
        msg = query.message
        edit = True
    else:
        msg = update.message
        edit = False
    kb = [
        [InlineKeyboardButton("➕ Додати набір", callback_data='set_add')],
        [InlineKeyboardButton("✏️ Редагувати набір", callback_data='set_edit')],
        [InlineKeyboardButton("🗑 Видалити набір", callback_data='set_remove')],
        [InlineKeyboardButton("📋 Список наборів", callback_data='set_list')],
        [InlineKeyboardButton("⬅️ Назад", callback_data='admin_panel')]
    ]
    if edit:
        await msg.edit_text("🧩 Керування наборами — оберіть дію:", reply_markup=InlineKeyboardMarkup(kb))
    else:
        await msg.reply_text("🧩 Керування наборами — оберіть дію:", reply_markup=InlineKeyboardMarkup(kb))

# ---------------- Додавання набору ----------------
async def set_add_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return ConversationHandler.END
    await update.callback_query.answer()
    await update.callback_query.edit_message_text("Введіть назву набору:")
    context.user_data['set'] = {}
    return SET_TITLE

async def set_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.setdefault('set', {})['title'] = update.message.text.strip()
    await update.message.reply_text("Введіть опис набору:")
    return SET_DESC

async def set_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['set']['description'] = update.message.text.strip()
    await update.message.reply_text("Введіть ціну набору (числом):")
    return SET_PRICE

async def set_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        price = int(update.message.text.strip())
        if price < 0:
            raise ValueError
        context.user_data['set']['price'] = price
        await update.message.reply_text("Введіть знижку у відсотках (0-100):")
        return SET_DISCOUNT
    except Exception:
        await update.message.reply_text("❌ Введіть коректне число для ціни:")
        return SET_PRICE

async def set_discount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        d = int(update.message.text.strip())
        if d < 0 or d > 100:
            raise ValueError
        context.user_data['set']['discount'] = d
        context.user_data['set']['items'] = []
        # Switch to item-by-item menu
        kb = [
            [InlineKeyboardButton("➕ Додати предмет", callback_data='set_item_add')],
            [InlineKeyboardButton("✅ Далі (фото набору)", callback_data='set_items_done')]
        ]
        await update.message.reply_text("Сформуйте набір: додавайте предмети по одному.", reply_markup=InlineKeyboardMarkup(kb))
        return SET_ITEMS_MENU
    except Exception:
        await update.message.reply_text("❌ Введіть знижку числом 0-100:")
        return SET_DISCOUNT

async def set_items_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Legacy text-based adding preserved for compatibility
    line = (update.message.text or '').strip()
    if not line:
        await update.message.reply_text("Введіть позицію або /done")
        return SET_ITEMS
    qty = 1
    note = ''
    title = line
    try:
        import re
        m = re.search(r"\sx(\d+)", line)
        if m:
            qty = int(m.group(1))
            title = re.sub(r"\sx\d+", "", line).strip()
        if '-' in title:
            parts = [p.strip() for p in title.split('-', 1)]
            title = parts[0]
            note = parts[1]
    except Exception:
        pass
    context.user_data['set']['items'].append({"title": title, "qty": qty, "note": note, "images": []})
    await update.message.reply_text("➕ Додано. Ще позицію або /done")
    return SET_ITEMS

async def set_items_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Support coming from inline button or plain text /done
    msg = update.callback_query.message if update.callback_query else update.message
    if update.callback_query:
        await update.callback_query.answer()
    await msg.reply_text("Надішліть фото набору (по одному). Введіть /done коли завершите:")
    context.user_data['set']['images'] = []
    return SET_PHOTOS

async def set_photo_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    photo = update.message.photo[-1]
    file = await photo.get_file()
    os.makedirs(image_folder, exist_ok=True)
    filename = f"set_{int(time.time())}_{len(context.user_data['set'].get('images', [])) + 1}.jpg"
    path = os.path.join(image_folder, filename)
    await file.download_to_drive(path)
    context.user_data['set'].setdefault('images', []).append(f"images/{filename}")
    await update.message.reply_text("Фото додано. Надішліть ще або /done")
    return SET_PHOTOS

async def set_photos_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    new_set = context.user_data.get('set', {})
    if not new_set.get('title'):
        await update.message.reply_text("❌ Немає назви — скасовано")
        return ConversationHandler.END
    # Persist
    sets = load_sets()
    new_set['id'] = str(int(time.time()))
    sets.append(new_set)
    save_sets(sets)
    await update.message.reply_text("✅ Набір додано!")
    # Send interactive preview with item buttons to swap photo
    try:
        await send_set_preview(new_set, update)
    except Exception as e:
        print(f"Failed to send set preview: {e}")
    # Back to sets panel
    await show_sets_panel(update, context)
    return ConversationHandler.END

# ===== New flow: add items one-by-one with photos =====
async def set_items_menu_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Handle inline menu buttons for items
    q = update.callback_query
    await q.answer()
    if q.data == 'set_item_add':
        await q.message.reply_text("Введіть назву предмета:")
        context.user_data['item_tmp'] = {"title": "", "qty": 1, "note": "", "images": []}
        return SET_ITEM_TITLE
    elif q.data == 'set_items_done':
        # jump to set photos step
        await q.message.reply_text("Надішліть фото набору (по одному). Введіть /done коли завершите:")
        context.user_data['set'].setdefault('images', [])
        return SET_PHOTOS
    return SET_ITEMS_MENU

async def set_item_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.setdefault('item_tmp', {})['title'] = (update.message.text or '').strip()
    await update.message.reply_text("Вкажіть кількість (ціле число, напр. 1,2,3):")
    return SET_ITEM_QTY

async def set_item_qty(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        qty = int((update.message.text or '1').strip())
        if qty <= 0:
            raise ValueError
    except Exception:
        await update.message.reply_text("❌ Введіть коректну кількість (1..):")
        return SET_ITEM_QTY
    context.user_data['item_tmp']['qty'] = qty
    await update.message.reply_text("Додайте примітку (або напишіть - якщо без примітки):")
    return SET_ITEM_NOTE

async def set_item_note(update: Update, context: ContextTypes.DEFAULT_TYPE):
    note = (update.message.text or '').strip()
    if note == '-':
        note = ''
    context.user_data['item_tmp']['note'] = note
    await update.message.reply_text("Надішліть фото предмета (по одному). Введіть /done коли завершите:")
    return SET_ITEM_PHOTO

async def set_item_photo_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Collect photos for current item
    if not update.message.photo:
        await update.message.reply_text("Надішліть фото або /done")
        return SET_ITEM_PHOTO
    photo = update.message.photo[-1]
    file = await photo.get_file()
    os.makedirs(image_folder, exist_ok=True)
    filename = f"set_item_{int(time.time())}_{len(context.user_data['item_tmp'].get('images', [])) + 1}.jpg"
    path = os.path.join(image_folder, filename)
    await file.download_to_drive(path)
    context.user_data['item_tmp'].setdefault('images', []).append(f"images/{filename}")
    await update.message.reply_text("Фото додано. Ще або /done")
    return SET_ITEM_PHOTO

async def set_item_photos_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Finish current item and return to items menu
    item = context.user_data.get('item_tmp') or {}
    if not item.get('title'):
        await update.message.reply_text("❌ Назва предмета відсутня, спробуйте ще раз.")
        return SET_ITEM_TITLE
    context.user_data.setdefault('set', {}).setdefault('items', []).append(item)
    context.user_data.pop('item_tmp', None)
    kb = [
        [InlineKeyboardButton("➕ Додати ще предмет", callback_data='set_item_add')],
        [InlineKeyboardButton("✅ Далі (фото набору)", callback_data='set_items_done')]
    ]
    await update.message.reply_text("✅ Предмет додано. Продовжити?", reply_markup=InlineKeyboardMarkup(kb))
    return SET_ITEMS_MENU

# ===== Interactive set preview (swap image to item photo) =====
async def send_set_preview(set_obj: dict, update: Update):
    # Choose initial image: set cover or first item image
    initial = None
    if set_obj.get('images'):
        initial = set_obj['images'][0]
    else:
        for it in set_obj.get('items', []):
            if it.get('images'):
                initial = it['images'][0]
                break
    if not initial:
        return
    caption = f"🧩 {set_obj.get('title','Набір')}\nОбраний елемент: —"
    kb = []
    for idx, it in enumerate(set_obj.get('items', [])):
        name = it.get('title', f'Предмет {idx+1}')
        kb.append([InlineKeyboardButton(name, callback_data=f"set_prev_item:{idx}")])
    reply_markup = InlineKeyboardMarkup(kb) if kb else None
    with open(os.path.join(os.path.dirname(__file__), initial), 'rb') as f:
        if update.message:
            await update.message.reply_photo(photo=f, caption=caption, reply_markup=reply_markup)
        elif update.callback_query:
            await update.callback_query.message.reply_photo(photo=f, caption=caption, reply_markup=reply_markup)

async def set_preview_swap(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    try:
        idx = int(q.data.split(":")[1])
    except Exception:
        return
    # Retrieve the last created set from user_data if present, else try loading from temp context
    # Here we don't persist; this preview is mainly after creation. To keep it simple, we store it in message context via not storing – instead, we derive from text is complex. We'll use user_data['set'] if present.
    set_obj = context.user_data.get('set')
    if not set_obj:
        await q.message.reply_text("Не можу знайти дані набору для прев'ю.")
        return
    items = set_obj.get('items', [])
    if not (0 <= idx < len(items)):
        return
    imgs = items[idx].get('images') or []
    if not imgs:
        await q.message.reply_text("Для цього предмета ще немає фото.")
        return
    path = os.path.join(os.path.dirname(__file__), imgs[0])
    if not os.path.exists(path):
        await q.message.reply_text("Фото не знайдено на сервері.")
        return
    with open(path, 'rb') as f:
        try:
            await q.message.edit_media(InputMediaPhoto(f), reply_markup=q.message.reply_markup)
        except Exception as e:
            print(f"edit_media error: {e}")

# ---------------- Перелік/видалення/редагування ----------------
async def set_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.callback_query:
        await update.callback_query.answer()
        msg = update.callback_query.message
    else:
        msg = update.message
    if not is_admin(update.effective_user.id):
        await msg.reply_text("❌ Немає прав")
        return
    sets = load_sets()
    if not sets:
        await msg.reply_text("Поки що немає створених наборів.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data='sets_panel')]]))
        return
    text = "📋 Список наборів:\n\n" + "\n".join([f"{i+1}. {s.get('title','Набір')} — ₴{s.get('price',0)}" for i,s in enumerate(sets)])
    await msg.reply_text(text, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data='sets_panel')]]))

async def set_remove_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return
    await update.callback_query.answer()
    sets = load_sets()
    if not sets:
        await update.callback_query.edit_message_text("Немає наборів для видалення.")
        return
    kb = [[InlineKeyboardButton(s.get('title','Набір'), callback_data=f"set_del:{i}")] for i, s in enumerate(sets)]
    kb.append([InlineKeyboardButton("⬅️ Назад", callback_data='sets_panel')])
    await update.callback_query.edit_message_text("Оберіть набір для видалення:", reply_markup=InlineKeyboardMarkup(kb))

async def set_delete_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.answer()
    idx = int(update.callback_query.data.split(":")[1])
    sets = load_sets()
    if 0 <= idx < len(sets):
        title = sets[idx].get('title','Набір')
        del sets[idx]
        save_sets(sets)
        await update.callback_query.edit_message_text(f"✅ Набір \"{title}\" видалено.")
    else:
        await update.callback_query.edit_message_text("❌ Невірний індекс")
    # Back
    await show_sets_panel(update, context)

async def set_edit_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return ConversationHandler.END
    await update.callback_query.answer()
    sets = load_sets()
    if not sets:
        await update.callback_query.edit_message_text("Поки що немає створених наборів.")
        return ConversationHandler.END
    kb = [[InlineKeyboardButton(f"{s.get('title','Набір')} (₴{s.get('price',0)})", callback_data=f"set_edit_idx:{i}")] for i,s in enumerate(sets)]
    kb.append([InlineKeyboardButton("⬅️ Назад", callback_data='sets_panel')])
    await update.callback_query.edit_message_text("Оберіть набір для редагування:", reply_markup=InlineKeyboardMarkup(kb))
    return SET_EDIT_SELECT

async def set_choose_edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.answer()
    idx = int(update.callback_query.data.split(":")[1])
    context.user_data['set_edit_idx'] = idx
    kb = [
        [InlineKeyboardButton("📄 Назва", callback_data='set_field:title')],
        [InlineKeyboardButton("📝 Опис", callback_data='set_field:description')],
        [InlineKeyboardButton("💰 Ціна", callback_data='set_field:price')],
        [InlineKeyboardButton("🎯 Знижка", callback_data='set_field:discount')],
        [InlineKeyboardButton("🧩 Склад (перезапис)", callback_data='set_field:items')],
        [InlineKeyboardButton("🖼 Фото (перезапис)", callback_data='set_field:images')],
        [InlineKeyboardButton("⬅️ Назад", callback_data='set_edit')]
    ]
    await update.callback_query.edit_message_text("Що змінити?", reply_markup=InlineKeyboardMarkup(kb))
    return SET_EDIT_FIELD

async def set_edit_field_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.answer()
    field = update.callback_query.data.split(":",1)[1]
    context.user_data['set_edit_field'] = field
    if field == 'images':
        await update.callback_query.edit_message_text("Надішліть нові фото (перезапис). Введіть /done коли завершите:")
        return SET_EDIT_PHOTO
    elif field == 'items':
        await update.callback_query.edit_message_text("Введіть склад набору заново, по одному рядку. /done для завершення:")
        context.user_data['set_items_tmp'] = []
        return SET_EDIT_VALUE
    else:
        await update.callback_query.edit_message_text("Введіть нове значення:")
        return SET_EDIT_VALUE

async def set_edit_save_value(update: Update, context: ContextTypes.DEFAULT_TYPE):
    idx = context.user_data.get('set_edit_idx')
    field = context.user_data.get('set_edit_field')
    sets = load_sets()
    if not (isinstance(idx, int) and 0 <= idx < len(sets)):
        await update.message.reply_text("❌ Набір не знайдено")
        return ConversationHandler.END
    if field == 'price':
        try:
            sets[idx]['price'] = int(update.message.text.strip())
        except Exception:
            await update.message.reply_text("❌ Введіть число для ціни:")
            return SET_EDIT_VALUE
    elif field == 'discount':
        try:
            d = int(update.message.text.strip())
            if d < 0 or d > 100:
                raise ValueError
            sets[idx]['discount'] = d
        except Exception:
            await update.message.reply_text("❌ Введіть число 0-100 для знижки:")
            return SET_EDIT_VALUE
    elif field == 'items':
        text = update.message.text.strip()
        if text.lower() == '/done':
            # Save accumulated items
            sets[idx]['items'] = context.user_data.get('set_items_tmp', [])
            context.user_data.pop('set_items_tmp', None)
            save_sets(sets)
            await update.message.reply_text("✅ Оновлено!")
            await show_sets_panel(update, context)
            return ConversationHandler.END
        else:
            # parse line to item object
            line = text
            qty = 1
            note = ''
            title = line
            try:
                import re
                m = re.search(r"\sx(\d+)", line)
                if m:
                    qty = int(m.group(1))
                    title = re.sub(r"\sx\d+", "", line).strip()
                if '-' in title:
                    parts = [p.strip() for p in title.split('-', 1)]
                    title = parts[0]
                    note = parts[1]
            except Exception:
                pass
            context.user_data.setdefault('set_items_tmp', []).append({"title": title, "qty": qty, "note": note})
            await update.message.reply_text("➕ Додано. Ще рядок або /done")
            return SET_EDIT_VALUE
    else:
        # Simple text fields
        val = update.message.text.strip()
        if not val:
            await update.message.reply_text("❌ Значення не може бути порожнім")
            return SET_EDIT_VALUE
        sets[idx][field] = val
    save_sets(sets)
    await update.message.reply_text("✅ Оновлено!")
    await show_sets_panel(update, context)
    return ConversationHandler.END

async def set_edit_save_photos(update: Update, context: ContextTypes.DEFAULT_TYPE):
    idx = context.user_data.get('set_edit_idx')
    sets = load_sets()
    if not (isinstance(idx, int) and 0 <= idx < len(sets)):
        await update.message.reply_text("❌ Набір не знайдено")
        return ConversationHandler.END
    if update.message.photo:
        photo = update.message.photo[-1]
        file = await photo.get_file()
        os.makedirs(image_folder, exist_ok=True)
        filename = f"set_{sets[idx].get('id','edit')}_{int(time.time())}.jpg"
        path = os.path.join(image_folder, filename)
        await file.download_to_drive(path)
        # On first photo of edit, reset images to empty to "перезапис"
        if context.user_data.get('set_edit_images_reset') != True:
            sets[idx]['images'] = []
            context.user_data['set_edit_images_reset'] = True
        sets[idx].setdefault('images', []).append(f"images/{filename}")
        save_sets(sets)
        await update.message.reply_text("Фото додано. Ще або /done")
        return SET_EDIT_PHOTO
    else:
        # Treat non-photo as done if it's /done
        txt = (update.message.text or '').strip().lower()
        if txt == '/done':
            context.user_data.pop('set_edit_images_reset', None)
            await update.message.reply_text("✅ Фото оновлено!")
            await show_sets_panel(update, context)
            return ConversationHandler.END
        await update.message.reply_text("Надішліть фото або /done")
        return SET_EDIT_PHOTO

async def handle_admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ У вас немає прав доступу до панелі адміністратора.")
        return
    
    keyboard = [
        [InlineKeyboardButton("🆔 Мій ID", callback_data="show_my_id")],
        [InlineKeyboardButton("➕ Додати адміністратора", callback_data="admin_add")],
        [InlineKeyboardButton("🗑 Видалити адміністратора", callback_data="admin_remove")],
        [InlineKeyboardButton("📋 Список адміністраторів", callback_data="admin_list")],
        [InlineKeyboardButton("📋 Замовлення", callback_data='orders_menu')],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu")],
        [InlineKeyboardButton("📝 Додати майстер-клас", callback_data='add_masterclass')],
        [InlineKeyboardButton("🗑 Видалити майстер-клас", callback_data='remove_masterclass')],
        [InlineKeyboardButton("👁 Переглянути майстер-класи", callback_data='list_masterclasses')],
        [InlineKeyboardButton("❌ Закрити адмін панель", callback_data='close_admin')]
    ]
    
    if update.callback_query:
        await update.callback_query.message.reply_text(
            "👑 Панель адміністратора:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    else:
        await update.message.reply_text(
            "👑 Панель адміністратора:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

async def admin_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.message.reply_text(
        "Введіть ID та ім'я користувача у форматі:\n"
        "`123456789 Ім'я Адміна`\n\n"
        "Де 123456789 - ID користувача, а 'Ім'я Адміна' - бажане відображуване ім'я.",
        parse_mode='Markdown'
    )
    return "AWAITING_ADMIN_ID"

async def admin_remove(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if len(ADMINS) <= 1:
        await query.message.reply_text("❌ Не можна видалити останнього адміністратора!")
        return
        
    buttons = [
        [InlineKeyboardButton(f"{admin['name']} (ID: {admin['id']})", 
                           callback_data=f"remove_admin:{admin['id']}")]
        for admin in ADMINS
    ]
    buttons.append([InlineKeyboardButton("🔙 Назад", callback_data="admin_panel")])
    
    await query.message.reply_text(
        "Оберіть адміністратора для видалення:",
        reply_markup=InlineKeyboardMarkup(buttons)
    )

async def admin_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    admin_list = []
    for i, admin in enumerate(ADMINS, 1):
        admin_list.append(f"{i}. {admin['name']} (`{admin['id']}`)")
    
    if not admin_list:
        await query.message.reply_text("❌ Список адміністраторів порожній")
    else:
        await query.message.reply_text(
            "👑 Список адміністраторів:\n\n" + "\n".join(admin_list),
            parse_mode='Markdown'
        )

async def process_admin_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        parts = update.message.text.strip().split(maxsplit=1)
        if len(parts) != 2:
            raise ValueError("Невірний формат. Використовуйте: ID Ім'я")
            
        new_admin_id = int(parts[0])
        admin_name = parts[1].strip()
        
        if any(admin["id"] == new_admin_id for admin in ADMINS):
            await update.message.reply_text("❌ Цей користувач вже є адміністратором.")
        else:
            ADMINS.append({"id": new_admin_id, "name": admin_name})
            with open(ADMINS_FILE, 'w', encoding='utf-8') as f:
                json.dump(ADMINS, f, ensure_ascii=False, indent=2)
            await update.message.reply_text(
                f"✅ Користувача {admin_name} ({new_admin_id}) додано як адміністратора!"
            )
    except ValueError as e:
        await update.message.reply_text(
            f"❌ Помилка: {str(e)}\n\n"
            "Будь ласка, використовуйте формат:\n"
            "`123456789 Ім'я Адміна`"
        )
    return ConversationHandler.END

async def remove_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    admin_to_remove = int(query.data.split(":")[1])
    
    if admin_to_remove not in [admin["id"] for admin in ADMINS]:
        await query.message.reply_text("❌ Помилка: адміністратор не знайдений.")
    elif len(ADMINS) <= 1:
        await query.message.reply_text("❌ Не можна видалити останнього адміністратора!")
    else:
        for admin in ADMINS:
            if admin["id"] == admin_to_remove:
                ADMINS.remove(admin)
                break
        with open(ADMINS_FILE, 'w') as f:
            json.dump(ADMINS, f, ensure_ascii=False, indent=2)
        await query.message.reply_text(f"✅ Адміністратора {admin_to_remove} видалено!")
    
    return ConversationHandler.END

async def show_my_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    await query.message.reply_text(
        f"🆔 Ваш ID: `{user.id}`\n"
        f"👤 Ім'я: {user.full_name}\n"
        f"📱 Нікнейм: @{user.username}" if user.username else "",
        parse_mode='Markdown'
    )

# ---------------------- ДОДАВАННЯ ----------------------

async def start_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.message.reply_text("Введіть назву свічки:")
    return TITLE

async def get_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    temp_product["title"] = update.message.text
    await update.message.reply_text("Введіть категорію (наприклад: Свічки десерти):")
    return CATEGORY

async def get_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    temp_product["category"] = update.message.text.strip()
    await update.message.reply_text("Введіть опис:")
    return DESCRIPTION

async def get_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    temp_product["description"] = update.message.text
    await update.message.reply_text("Введіть ціну:")
    return PRICE

async def get_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        temp_product["price"] = int(update.message.text)
        await update.message.reply_text("Введіть знижку у відсотках (наприклад: 10 для 10% або 0 якщо знижки немає):")
        return DISCOUNT
    except ValueError:
        await update.message.reply_text("Введіть числову ціну:")
        return PRICE

async def get_discount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        discount = int(update.message.text)
        if discount < 0 or discount > 100:
            raise ValueError("Знижка повинна бути від 0 до 100%")
        temp_product["discount"] = discount
        await update.message.reply_text("Введіть характеристику (по одній). Введіть /done коли завершите:")
        temp_product["specs"] = []
        return SPECS
    except ValueError as e:
        await update.message.reply_text(f"Помилка: {str(e)}. Введіть число від 0 до 100:")
        return DISCOUNT

# --- ДОБАВИМ поддержку перехода от характеристик к отзывам ---
async def get_specs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if "specs" not in temp_product:
        temp_product["specs"] = []

    if text.lower() == "/done":
        await update.message.reply_text("Тепер можете додати вiдгуки або /skip")
        temp_product["reviews"] = []  # Инициализируем, даже если будет /skip
        return REVIEWS

    temp_product["specs"].append(text)
    await update.message.reply_text("➕ Додано. Введiть ще характеристику або /done")
    return SPECS

# --- ДОБАВИМ поддержку skip в отзывах ---
async def get_reviews(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text

    if text.lower() == "/done" or text.lower() == "/skip":
        await update.message.reply_text("Надiшлiть фото (по одному). Введiть /done коли завершите:")
        temp_product["images"] = []
        return PHOTOS

    if "reviews" not in temp_product:
        temp_product["reviews"] = []
    temp_product["reviews"].append(text)
    await update.message.reply_text("➕ Додано. Введiть ще вiдгук або /done")
    return REVIEWS

# Специальные обработчики команд для корректной работы /done и /skip в PTB v20
async def specs_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if "reviews" not in temp_product:
        temp_product["reviews"] = []
    await update.message.reply_text("Тепер можете додати вiдгуки або /skip")
    return REVIEWS

async def reviews_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if "images" not in temp_product:
        temp_product["images"] = []
    await update.message.reply_text("Надiшлiть фото (по одному). Введiть /done коли завершите:")
    return PHOTOS



async def get_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    photo = update.message.photo[-1]
    file = await photo.get_file()
    filename = f"{temp_product['title'].replace(' ', '_')}_{len(temp_product['images']) + 1}.jpg"
    path = os.path.join(image_folder, filename)
    # Ensure images folder exists
    os.makedirs(image_folder, exist_ok=True)
    await file.download_to_drive(path)
    temp_product["images"].append(f"images/{filename}")
    await update.message.reply_text("Фото додано. Надішліть ще або /done")
    return PHOTOS

async def finish_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    products = []
    if os.path.exists(products_file):
        with open(products_file, "r", encoding="utf-8") as f:
            products = json.load(f)
    product_copy = temp_product.copy()
    products.append(product_copy)
    with open(products_file, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    await update.message.reply_text("✅ Свічку додано!")
    # Показ прев'ю должен использовать сохраненную копию, а не очищенный словарь
    await send_card_preview(product_copy, update)
    temp_product.clear()
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    temp_product.clear()
    await update.message.reply_text("❌ Скасовано")
    return ConversationHandler.END

# ---------------------- МОЇ КАРТКИ ----------------------

async def list_products(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if os.path.exists(products_file):
        with open(products_file, "r", encoding="utf-8") as f:
            products = json.load(f)
        if products:
            text = "\n".join(f"• {p['title']}" for p in products)
            await query.message.reply_text(f"Ваші товари:\n{text}")
        else:
            await query.message.reply_text("Список порожній")
    else:
        await query.message.reply_text("Файл товарів не знайдено")

# ---------------------- ОГЛЯДИ (АДМІН) ----------------------

async def show_reviews_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показати список товарів для перегляду відгуків (тільки для адмінів)"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        # Support both message-trigger and callback-trigger
        if update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text("❌ У вас немає прав доступу до розділу відгуків.")
        else:
            await update.message.reply_text("❌ У вас немає прав доступу до розділу відгуків.")
        return

    query = update.callback_query
    if query:
        await query.answer()
        message = query.message
    else:
        message = update.message

    if not os.path.exists(products_file):
        await message.reply_text("Файл товарів не знайдено")
        return

    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    if not products:
        await message.reply_text("Список товарів порожній")
        return

    buttons = [[InlineKeyboardButton(p['title'], callback_data=f"reviews_product:{i}")]
               for i, p in enumerate(products)]
    # Add admin action to clear all reviews
    buttons.append([InlineKeyboardButton("🧼 Очистити ВСІ відгуки", callback_data='clear_all_reviews_confirm')])
    buttons.append([InlineKeyboardButton("🔙 Назад", callback_data='menu')])
    await message.reply_text("Оберіть товар для перегляду відгуків:", reply_markup=InlineKeyboardMarkup(buttons))

async def show_product_reviews(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показати відгуки конкретного товару з можливістю видалення (тільки адміни)"""
    user_id = update.effective_user.id
    query = update.callback_query
    await query.answer()
    if not is_admin(user_id):
        await query.message.reply_text("❌ У вас немає прав доступу")
        return

    try:
        product_index = int(query.data.split(":")[1])
    except Exception:
        await query.message.reply_text("Некоректний запит")
        return

    if not os.path.exists(products_file):
        await query.message.reply_text("Файл товарів не знайдено")
        return

    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    if product_index < 0 or product_index >= len(products):
        await query.message.reply_text("Товар не знайдено")
        return

    product = products[product_index]
    title = normalize_title_key(product.get('title', ''))
    # Load reviews from the shared reviews.json map
    reviews_map = load_reviews_map()
    reviews = reviews_map.get(title, [])

    # Normalize reviews to text list for rendering
    lines = []
    for i, r in enumerate(reviews):
        if isinstance(r, dict):
            author = r.get("author") or r.get("name") or r.get("user") or "Користувач"
            text = r.get("text") or r.get("review") or r.get("comment") or ""
            rating = None
            try:
                rating = int(r.get("rating")) if r.get("rating") is not None else None
            except Exception:
                rating = None
            stars = "" if not rating else "⭐" * max(1, min(5, rating)) + " "
            date = (r.get("date") or "").strip()
            date_part = f"  — {date}" if date else ""
            lines.append(f"{i+1}. {stars}{author}:{date_part}\n{text}")
        else:
            lines.append(f"{i+1}. {str(r)}")

    if not lines:
        text = f"🗒 Відгуки для \"{product.get('title','Без назви')}\":\n(поки що немає)"
    else:
        text = "\n\n".join([f"🗒 Відгуки для \"{product.get('title','Без назви')}\":" ] + lines)

    # Buttons: delete per review, clear all for this product, back
    buttons = []
    for i, _ in enumerate(reviews):
        buttons.append([InlineKeyboardButton(f"🗑 Видалити відгук #{i+1}", callback_data=f"del_review:{product_index}:{i}")])
    buttons.append([InlineKeyboardButton("🧹 Очистити усі відгуки товару", callback_data=f"clear_reviews:{product_index}")])
    buttons.append([InlineKeyboardButton("⬅️ Назад", callback_data='reviews_menu')])
    await query.message.reply_text(text, reply_markup=InlineKeyboardMarkup(buttons))

async def delete_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Видалити конкретний відгук (тільки для адмінів)"""
    user_id = update.effective_user.id
    query = update.callback_query
    await query.answer()
    if not is_admin(user_id):
        await query.message.reply_text("❌ У вас немає прав доступу")
        return

    try:
        _, p_idx, r_idx = query.data.split(":")
        p_idx = int(p_idx)
        r_idx = int(r_idx)
    except Exception:
        await query.message.reply_text("Некоректний запит видалення")
        return

    if not os.path.exists(products_file):
        await query.message.reply_text("Файл товарів не знайдено")
        return

    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    if p_idx < 0 or p_idx >= len(products):
        await query.message.reply_text("Товар не знайдено")
        return

    product = products[p_idx]
    title = normalize_title_key(product.get('title', ''))
    reviews_map = load_reviews_map()
    reviews = reviews_map.get(title, [])
    if r_idx < 0 or r_idx >= len(reviews):
        await query.message.reply_text("Відгук не знайдено")
        return

    before = len(reviews)
    # Remove and persist in reviews.json map
    try:
        reviews.pop(r_idx)
    except Exception as e:
        await query.message.reply_text(f"⚠️ Помилка видалення: {e}")
        return
    reviews_map[title] = reviews
    save_reviews_map(reviews_map)

    # Re-load to verify
    verify_map = load_reviews_map()
    after = len(verify_map.get(title, []))
    await query.message.reply_text(f"✅ Відгук видалено. Залишилось: {after}")
    # Показати оновлений список відгуків
    # Відтворюємо показ без дублювання логіки
    fake_update = update  # використовуємо ті самі об'єкти
    fake_update.callback_query.data = f"reviews_product:{p_idx}"
    await show_product_reviews(fake_update, context)

async def clear_product_reviews(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Очистити всі відгуки конкретного товару (тільки адміни)"""
    user_id = update.effective_user.id
    query = update.callback_query
    await query.answer()
    if not is_admin(user_id):
        await query.message.reply_text("❌ У вас немає прав доступу")
        return

    try:
        _, p_idx = query.data.split(":")
        p_idx = int(p_idx)
    except Exception:
        await query.message.reply_text("Некоректний запит очищення")
        return

    if not os.path.exists(products_file):
        await query.message.reply_text("Файл товарів не знайдено")
        return

    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    if p_idx < 0 or p_idx >= len(products):
        await query.message.reply_text("Товар не знайдено")
        return

    product = products[p_idx]
    title = normalize_title_key(product.get('title', ''))
    reviews_map = load_reviews_map()
    removed = len(reviews_map.get(title, []))
    reviews_map[title] = []
    save_reviews_map(reviews_map)
    # Verify
    verify_map = load_reviews_map()
    left = len(verify_map.get(title, []))
    await query.message.reply_text(f"✅ Очищено {removed}. Залишилось: {left} — для \"{product.get('title','')}\"")

    # Refresh product reviews view
    fake_update = update
    fake_update.callback_query.data = f"reviews_product:{p_idx}"
    await show_product_reviews(fake_update, context)

async def clear_all_reviews_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Підтвердження повного очищення всіх відгуків (тільки адміни)"""
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer()
        await update.callback_query.message.reply_text("❌ Немає прав")
        return
    await update.callback_query.answer()
    kb = [
        [InlineKeyboardButton("✅ Підтвердити очищення", callback_data='clear_all_reviews')],
        [InlineKeyboardButton("↩ Скасувати", callback_data='reviews_menu')]
    ]
    await update.callback_query.message.reply_text(
        "⚠️ Ви впевнені, що хочете видалити ВСІ відгуки для всіх товарів? Дія незворотна.",
        reply_markup=InlineKeyboardMarkup(kb)
    )

async def clear_all_reviews(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Повне очищення всіх відгуків (тільки адміни)"""
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer()
        await update.callback_query.message.reply_text("❌ Немає прав")
        return
    await update.callback_query.answer()
    save_reviews_map({})
    # Verify
    verify_map = load_reviews_map()
    total_keys = len(verify_map.keys())
    await update.callback_query.message.reply_text(f"🧼 Готово. Усі відгуки видалено. Ключів у файлі: {total_keys}")

# ---------------------- ВИДАЛЕННЯ ----------------------

async def ask_delete(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)
    buttons = [[InlineKeyboardButton(p['title'], callback_data=f"del:{i}")] for i, p in enumerate(products)]
    await query.message.reply_text("Оберіть товар для видалення:", reply_markup=InlineKeyboardMarkup(buttons))

async def confirm_delete(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    index = int(query.data.split(":")[1])
    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)
    product = products[index]
    context.user_data['del_index'] = index
    keyboard = [[
        InlineKeyboardButton("✅ Видалити", callback_data="confirm_del"),
        InlineKeyboardButton("↩ Назад", callback_data="menu")
    ]]
    await query.message.reply_text(f"Видалити \"{product['title']}\"?", reply_markup=InlineKeyboardMarkup(keyboard))

async def delete_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    index = context.user_data.get("del_index")

    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    product = products[index]
    title = product["title"]

    # 🧹 Удаляем изображения
    for img_path in product.get("images", []):
        try:
            full_path = os.path.join(os.path.dirname(__file__), img_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                print(f"[🗑] Видалено фото: {full_path}")
        except Exception as e:
            print(f"[⚠️] Не вдалося видалити {img_path}: {e}")

    # 🗑 Удаляем товар
    del products[index]

    with open(products_file, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    await query.message.reply_text(f"✅ Товар \"{title}\" та його зображення видалено.")

# ---------------------- ГОЛОВНА ----------------------

async def get_reviews_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Тепер можете додати відгуки або /skip")
    return REVIEWS

async def get_photo_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    temp_product["images"] = []
    await update.message.reply_text("Надішліть фото (по одному). Введіть /done коли завершите:")
    return PHOTOS


async def ask_edit(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.answer()
    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    buttons = [[InlineKeyboardButton(p['title'],
                                     callback_data=f"edit:{i}")]
               for i, p in enumerate(products)]
    await update.callback_query.message.reply_text(
        "Оберіть товар:",
        reply_markup=InlineKeyboardMarkup(buttons)
    )
    return EDIT_SELECT        # ← було EDIT_FIELD або нічого


async def choose_edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Admin-only
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return ConversationHandler.END
    await update.callback_query.answer()
    index = int(update.callback_query.data.split(":")[1])
    context.user_data["edit_index"] = index
    buttons = [
        [InlineKeyboardButton("📷 Фото", callback_data="edit_field:photo")],
        [InlineKeyboardButton("📄 Назва", callback_data="edit_field:title")],
        [InlineKeyboardButton("� Категорія", callback_data="edit_field:category")],
        [InlineKeyboardButton("💰 Ціна", callback_data="edit_field:price")],
        [InlineKeyboardButton("🎯 Знижка", callback_data="edit_field:discount")],
        [InlineKeyboardButton("�📈 Опис", callback_data="edit_field:description")],
        [InlineKeyboardButton("📅 Характеристики", callback_data="edit_field:specs")],
        [InlineKeyboardButton("⭐ Відгуки", callback_data="edit_field:reviews")]
    ]
    await update.callback_query.message.reply_text("Що змінити?", reply_markup=InlineKeyboardMarkup(buttons))
    return EDIT_FIELD

async def edit_field_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Admin-only
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return ConversationHandler.END
    await update.callback_query.answer()
    field = update.callback_query.data.split(":")[1]
    context.user_data["edit_field"] = field
    if field == "photo":
        # Multi-photo replace flow: reset on first photo, then accumulate until /done
        context.user_data.pop('edit_images_reset', None)
        await update.callback_query.message.reply_text("Надішліть нові фото (по одному). Введіть /done коли завершите:")
        return EDIT_PHOTO
    elif field in ["specs", "reviews"]:
        # Multi-line replace flow for specs/reviews
        buf_key = 'edit_specs_tmp' if field == 'specs' else 'edit_reviews_tmp'
        context.user_data[buf_key] = []
        await update.callback_query.message.reply_text(
            "Введіть значення по одному рядку. Введіть /done коли завершите:")
        return EDIT_VALUE
    else:
        await update.callback_query.message.reply_text("Введіть нове значення:")
        return EDIT_VALUE

async def save_new_value(update: Update, context: ContextTypes.DEFAULT_TYPE):
    index = context.user_data["edit_index"]
    field = context.user_data["edit_field"]
    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)
    
    text = update.message.text.strip()
    
    try:
        if field == "price":
            # Validate price is a positive number
            price = int(text)
            if price <= 0:
                await update.message.reply_text("❌ Ціна повинна бути більше 0. Спробуйте ще раз:")
                return EDIT_VALUE
            products[index][field] = price
            
        elif field == "discount":
            # Validate discount is between 0 and 100
            discount = int(text)
            if discount < 0 or discount > 100:
                await update.message.reply_text("❌ Знижка повинна бути від 0 до 100. Спробуйте ще раз:")
                return EDIT_VALUE
            products[index][field] = discount
            
        elif field in ["title", "category", "description"]:
            # Simple text fields
            if not text:
                await update.message.reply_text("❌ Значення не може бути порожнім. Спробуйте ще раз:")
                return EDIT_VALUE
            products[index][field] = text
            
        elif field in ["specs", "reviews"]:
            # Iterative collection: append until /done, then save
            if text.lower() == '/done':
                buf_key = 'edit_specs_tmp' if field == 'specs' else 'edit_reviews_tmp'
                items = context.user_data.get(buf_key, [])
                products[index][field] = items
                # cleanup buffer
                context.user_data.pop(buf_key, None)
            else:
                buf_key = 'edit_specs_tmp' if field == 'specs' else 'edit_reviews_tmp'
                context.user_data.setdefault(buf_key, []).append(text)
                await update.message.reply_text("➕ Додано. Ще рядок або /done")
                return EDIT_VALUE
            
        with open(products_file, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)
            
        await update.message.reply_text("✅ Оновлено!")
        await send_card_preview(products[index], update)
        return ConversationHandler.END
        
    except ValueError as e:
        if field in ["price", "discount"]:
            await update.message.reply_text(f"❌ Будь ласка, введіть коректне число. {str(e)}")
        else:
            await update.message.reply_text(f"❌ Помилка: {str(e)}")
        return EDIT_VALUE

async def save_new_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    index = context.user_data["edit_index"]
    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)
    # If user sends /done, finish
    if update.message.text and update.message.text.strip().lower() == '/done':
        # cleanup flag
        context.user_data.pop('edit_images_reset', None)
        with open(products_file, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)
        await update.message.reply_text("✅ Фото оновлено!")
        await send_card_preview(products[index], update)
        return ConversationHandler.END

    # Expecting a photo: on first photo reset existing images and delete files
    if update.message.photo:
        if context.user_data.get('edit_images_reset') != True:
            # delete old files and reset list only once
            for img in products[index].get("images", []):
                path_old = os.path.join(os.path.dirname(__file__), img)
                try:
                    if os.path.exists(path_old):
                        os.remove(path_old)
                except Exception:
                    pass
            products[index]["images"] = []
            context.user_data['edit_images_reset'] = True
        photo = update.message.photo[-1]
        file = await photo.get_file()
        os.makedirs(image_folder, exist_ok=True)
        filename = f"{products[index]['title'].replace(' ', '_')}_{int(time.time())}_{len(products[index].get('images', []))+1}.jpg"
        path = os.path.join(image_folder, filename)
        await file.download_to_drive(path)
        products[index].setdefault("images", []).append(f"images/{filename}")
        with open(products_file, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)
        await update.message.reply_text("Фото додано. Надішліть ще або /done")
        return EDIT_PHOTO
    else:
        await update.message.reply_text("Надішліть фото або /done")
        return EDIT_PHOTO

async def send_card_preview(product, update):
    from html2image import Html2Image
    hti = Html2Image(output_path='previews')
    os.makedirs('previews', exist_ok=True)

    # Получаем абсолютный путь к первому фото
    if product.get("images"):
        img_path = os.path.abspath(product["images"][0])
        img_path = img_path.replace(os.sep, "/")
        image_tag = f'<img src="file:///{img_path}" style="width:100%;border-radius:10px;">'
    else:
        image_tag = ''

    html = f"""
    <html>
    <body style='font-family:sans-serif;background:#fff;padding:20px;width:320px;border:1px solid #ccc;border-radius:10px;'>
        {image_tag}
        <h2 style='margin:10px 0;'>{product.get("title", "")}</h2>
        <p><b>Категорія:</b> {product.get("category", "")}</p>
        <p><b>Ціна:</b> {product.get("price", "")} грн</p>
        <p><b>Знижка:</b> {product.get("discount", 0)}%</p>
        <p><b>Опис:</b> {product.get("description", "")}</p>
    </body>
    </html>
    """

    hti.screenshot(html_str=html, save_as="preview.png")

    with open(os.path.join("previews", "preview.png"), "rb") as img:
        if update.message:
            await update.message.reply_photo(photo=img, caption="🖼 Ось як виглядає товар")
        elif update.callback_query:
            await update.callback_query.message.reply_photo(photo=img, caption="🖼 Ось як виглядає товар")

# Create a simple Flask server to serve the admin list
app_web = Flask(__name__)
try:
    CORS(app_web, resources={r"/api/*": {"origins": "*"}})
except Exception:
    # Fallback: manually add CORS headers if flask_cors is missing
    pass

@app_web.after_request
def apply_cors_headers(response):
    try:
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    except Exception:
        pass
    return response

# Serve static files
@app_web.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('images', filename)

# =====================
# Reviews storage (server-side sync for site and bot)
# =====================
REVIEWS_FILE = os.path.join(os.path.dirname(__file__), 'reviews.json')

def normalize_title_key(title: str) -> str:
    """Normalize product title to a stable key: trim, collapse whitespace, remove duplicate spaces around emojis.
    Does not remove emojis to keep human-readable mapping, only standardizes spacing.
    """
    if not isinstance(title, str):
        return ''
    t = title.strip()
    # Collapse multiple spaces to a single space
    t = re.sub(r"\s+", " ", t)
    return t

def load_reviews_map():
    if os.path.exists(REVIEWS_FILE):
        try:
            with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            print(f"Failed to read reviews.json: {e}")
    return {}

def save_reviews_map(data: dict):
    try:
        # Ensure directory exists (it does) and file is created
        with open(REVIEWS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Failed to write reviews.json: {e}")

@app_web.route('/api/reviews', methods=['GET'])
def api_get_reviews():
    raw_title = request.args.get('title', '').strip()
    title = normalize_title_key(raw_title)
    data = load_reviews_map()
    if not title:
        # Return all reviews map (admin/debug)
        return jsonify(data)
    return jsonify(data.get(title, []))

@app_web.route('/api/reviews', methods=['OPTIONS'])
def api_reviews_options():
    # For CORS preflight
    return ('', 204)

@app_web.route('/api/reviews', methods=['POST'])
def api_add_review():
    try:
        payload = request.get_json(force=True) or {}
        raw_title = (payload.get('title') or '').strip()
        title = normalize_title_key(raw_title)
        if not title:
            return jsonify({"status": "error", "message": "title is required"}), 400

        review = {
            "user": (payload.get('user') or '').strip() or 'Пользователь',
            "rating": int(payload.get('rating') or 5),
            "comment": (payload.get('comment') or '').strip(),
            "date": (payload.get('date') or '').strip() or time.strftime('%Y-%m-%d')
        }

        data = load_reviews_map()
        data.setdefault(title, []).append(review)
        save_reviews_map(data)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"Error in api_add_review: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app_web.route('/api/reviews', methods=['DELETE'])
def api_delete_review():
    try:
        payload = request.get_json(force=True) or {}
        raw_title = (payload.get('title') or '').strip()
        title = normalize_title_key(raw_title)
        index = payload.get('index')
        if not title or index is None:
            return jsonify({"status": "error", "message": "title and index are required"}), 400

        data = load_reviews_map()
        reviews = data.get(title, [])
        if not (0 <= int(index) < len(reviews)):
            return jsonify({"status": "error", "message": "index out of range"}), 400
        reviews.pop(int(index))
        data[title] = reviews
        save_reviews_map(data)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"Error in api_delete_review: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# API endpoint to get all master classes
@app_web.route('/api/masterclasses', methods=['GET'])
def get_masterclasses():
    masterclasses = load_masterclasses()
    return jsonify(masterclasses)

# API endpoint to register for a master class
@app_web.route('/api/register-masterclass', methods=['POST'])
def register_masterclass():
    try:
        data = request.json
        # Here you can add code to process the registration
        # For example, send a notification to the admin
        print(f"New master class registration: {data}")
        
        # You can also send a notification to the admin via Telegram
        # Uncomment and modify the following lines if you want to enable Telegram notifications
        """
        message = (
            "📝 *Нова заявка на майстер-клас*\n\n"
            f"📌 *Майстер-клас:* {data.get('masterclassTitle', 'Невідомо')}\n"
            f"👤 *Ім'я:* {data.get('name', 'Не вказано')}\n"
            f"📞 *Телефон:* {data.get('phone', 'Не вказано')}\n"
            f"📧 *Email:* {data.get('email', 'Не вказано')}"
        )
        
        # Send notification to all admins
        for admin in ADMINS:
            try:
                application.bot.send_message(
                    chat_id=admin['id'],
                    text=message,
                    parse_mode='Markdown'
                )
            except Exception as e:
                print(f"Failed to send notification to admin {admin['id']}: {e}")
        """
        
        return jsonify({"status": "success", "message": "Registration successful"}), 200
    except Exception as e:
        print(f"Error processing registration: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app_web.route('/api/admins', methods=['GET'])
def get_admins():
    # Expose admin IDs and names so the frontend chat can reach all admins
    return jsonify([{"id": admin["id"], "name": admin["name"]} for admin in ADMINS])

def run_web_server():
    """Run the Flask web server in a separate thread"""
    app_web.run(host='0.0.0.0', port=5000)

def load_masterclasses():
    if os.path.exists(MASTERCLASSES_FILE):
        with open(MASTERCLASSES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_masterclasses(masterclasses):
    with open(MASTERCLASSES_FILE, 'w', encoding='utf-8') as f:
        json.dump(masterclasses, f, ensure_ascii=False, indent=2)

# Master class conversation handler
MASTERCLASS_TITLE, MASTERCLASS_DESC, MASTERCLASS_DURATION, MASTERCLASS_LEVEL, MASTERCLASS_PRICE, MASTERCLASS_IMAGE, MASTERCLASS_VIDEO = range(7)

# Masterclass edit states
MC_EDIT_SELECT, MC_EDIT_FIELD, MC_EDIT_VALUE, MC_EDIT_PHOTO = range(200, 204)

async def add_masterclass_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Admin-only
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return ConversationHandler.END
    await update.callback_query.answer()
    await update.callback_query.edit_message_text("Введіть назву майстер-класу:")
    return MASTERCLASS_TITLE

async def masterclass_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['masterclass'] = {'title': update.message.text}
    await update.message.reply_text("Введіть опис майстер-класу:")
    return MASTERCLASS_DESC

async def masterclass_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['masterclass']['description'] = update.message.text
    await update.message.reply_text("Введіть тривалість майстер-класу (наприклад, '2 години'):")
    return MASTERCLASS_DURATION

async def masterclass_duration(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['masterclass']['duration'] = update.message.text
    await update.message.reply_text("Введіть рівень складності (наприклад, 'Початківець'):")
    return MASTERCLASS_LEVEL

async def masterclass_level(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['masterclass']['level'] = update.message.text
    await update.message.reply_text("Введіть вартість майстер-класу (тільки цифри):")
    return MASTERCLASS_PRICE

async def masterclass_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        price = int(update.message.text)
        context.user_data['masterclass']['price'] = price
        await update.message.reply_text("Завантажте зображення для майстер-класу:")
        return MASTERCLASS_IMAGE
    except ValueError:
        await update.message.reply_text("Будь ласка, введіть коректну суму (тільки цифри):")
        return MASTERCLASS_PRICE

async def masterclass_image(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.photo:
        # Get the highest resolution photo
        photo = update.message.photo[-1]
        file = await context.bot.get_file(photo.file_id)
        
        # Create images directory if it doesn't exist
        if not os.path.exists('images'):
            os.makedirs('images')
            
        # Save the image
        image_path = f"images/masterclass_{int(time.time())}.jpg"
        await file.download_to_drive(image_path)
        context.user_data['masterclass']['image'] = image_path
        
        await update.message.reply_text("Введіть посилання на відео майстер-класу (YouTube або інший хостинг):")
        return MASTERCLASS_VIDEO
    else:
        await update.message.reply_text("Будь ласка, завантажте зображення.")
        return MASTERCLASS_IMAGE

async def masterclass_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    video_url = update.message.text
    context.user_data['masterclass']['video_url'] = video_url
    
    # Save the master class
    masterclass = context.user_data['masterclass']
    masterclasses = load_masterclasses()
    masterclass['id'] = str(int(time.time()))  # Simple ID based on timestamp
    masterclasses.append(masterclass)
    save_masterclasses(masterclasses)
    
    await update.message.reply_text("✅ Майстер-клас успішно додано!")
    
    # Show admin panel again
    await handle_admin_panel(update, context)
    return ConversationHandler.END

# Remove master class
async def remove_masterclass_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Admin-only
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return ConversationHandler.END
    await update.callback_query.answer()
    masterclasses = load_masterclasses()
    
    if not masterclasses:
        await update.callback_query.edit_message_text("Немає доступних майстер-класів для видалення.")
        await handle_admin_panel(update, context)
        return
    
    keyboard = []
    for mc in masterclasses:
        keyboard.append([
            InlineKeyboardButton(
                f"{mc['title']} ({mc['price']} грн)", 
                callback_data=f"delete_mc_{mc['id']}"
            )
        ])
    
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data='admin_panel')])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.callback_query.edit_message_text("Оберіть майстер-клас для видалення:", reply_markup=reply_markup)

async def delete_masterclass(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Admin-only
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return
    await update.callback_query.answer()
    masterclass_id = update.callback_query.data.split("_")[-1]
    
    masterclasses = load_masterclasses()
    # IDs зберігаються як рядки, тому порівнюємо як рядки
    masterclasses = [mc for mc in masterclasses if str(mc.get('id')) != str(masterclass_id)]
    save_masterclasses(masterclasses)
    
    await update.callback_query.edit_message_text("✅ Майстер-клас успішно видалено!")
    await handle_admin_panel(update, context)

# List master classes
async def list_masterclasses(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Admin-only
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return
    await update.callback_query.answer()
    masterclasses = load_masterclasses()
    
    if not masterclasses:
        await update.callback_query.edit_message_text(
            "Поки що немає доданих майстер-класів.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data='masterclasses_panel')]])
        )
        return
    
    message = "📋 Список майстер-класів:\n\n"
    for i, mc in enumerate(masterclasses, 1):
        message += (
            f"{i}. {mc['title']}\n"
            f"   💰 Ціна: {mc['price']} грн\n"
            f"   ⏱ Тривалість: {mc.get('duration', 'Невказано')}\n"
            f"   📊 Рівень: {mc.get('level', 'Невказано')}\n\n"
        )
    
    await update.callback_query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data='masterclasses_panel')]])
    )

# =====================
# Masterclass Edit Flow
# =====================

async def edit_masterclass_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start editing: choose a masterclass"""
    # Admin-only
    if not is_admin(update.effective_user.id):
        await update.callback_query.answer("Немає прав", show_alert=True)
        return ConversationHandler.END
    await update.callback_query.answer()
    masterclasses = load_masterclasses()
    if not masterclasses:
        await update.callback_query.edit_message_text("Поки що немає доданих майстер-класів.")
        await handle_admin_panel(update, context)
        return ConversationHandler.END

    buttons = [[InlineKeyboardButton(f"{mc['title']} ({mc.get('price','-')} грн)", callback_data=f"mc_edit:{mc['id']}")]
               for mc in masterclasses]
    buttons.append([InlineKeyboardButton("⬅️ Назад", callback_data='masterclasses_panel')])
    await update.callback_query.edit_message_text(
        "Оберіть майстер-клас для редагування:", reply_markup=InlineKeyboardMarkup(buttons)
    )
    return MC_EDIT_SELECT

async def mc_choose_edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Choose which field to edit for a selected masterclass"""
    await update.callback_query.answer()
    mc_id = update.callback_query.data.split(":", 1)[1]
    context.user_data['mc_edit_id'] = mc_id

    buttons = [
        [InlineKeyboardButton("📄 Назва", callback_data=f"mc_field:{mc_id}:title")],
        [InlineKeyboardButton("📝 Опис", callback_data=f"mc_field:{mc_id}:description")],
        [InlineKeyboardButton("⏱ Тривалість", callback_data=f"mc_field:{mc_id}:duration")],
        [InlineKeyboardButton("📊 Рівень", callback_data=f"mc_field:{mc_id}:level")],
        [InlineKeyboardButton("💰 Ціна", callback_data=f"mc_field:{mc_id}:price")],
        [InlineKeyboardButton("🖼 Зображення", callback_data=f"mc_field:{mc_id}:image")],
        [InlineKeyboardButton("🎬 Відео URL", callback_data=f"mc_field:{mc_id}:video_url")],
        [InlineKeyboardButton("⬅️ Назад", callback_data='edit_masterclass')]
    ]
    await update.callback_query.edit_message_text(
        "Що змінити?", reply_markup=InlineKeyboardMarkup(buttons)
    )
    return MC_EDIT_FIELD

async def mc_edit_field_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt for new value or photo depending on field"""
    await update.callback_query.answer()
    _, mc_id, field = update.callback_query.data.split(":", 2)
    context.user_data['mc_edit_id'] = mc_id
    context.user_data['mc_edit_field'] = field

    if field == 'image':
        await update.callback_query.edit_message_text("Надішліть нове фото майстер-класу:")
        return MC_EDIT_PHOTO
    else:
        await update.callback_query.edit_message_text("Введіть нове значення:")
        return MC_EDIT_VALUE

async def mc_save_new_value(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Save new text/number value for a field"""
    mc_id = context.user_data.get('mc_edit_id')
    field = context.user_data.get('mc_edit_field')
    text = update.message.text.strip()

    masterclasses = load_masterclasses()
    for mc in masterclasses:
        if str(mc.get('id')) == str(mc_id):
            if field == 'price':
                try:
                    mc['price'] = int(text)
                except ValueError:
                    await update.message.reply_text("❌ Будь ласка, введіть коректне число для ціни:")
                    return MC_EDIT_VALUE
            else:
                mc[field] = text
            save_masterclasses(masterclasses)
            await update.message.reply_text("✅ Оновлено!")
            await show_masterclasses_panel(update, context)
            return ConversationHandler.END

    await update.message.reply_text("❌ Майстер-клас не знайдено")
    return ConversationHandler.END

async def mc_save_new_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Save new image for a masterclass"""
    mc_id = context.user_data.get('mc_edit_id')
    if not update.message.photo:
        await update.message.reply_text("Будь ласка, надішліть фото")
        return MC_EDIT_PHOTO

    photo = update.message.photo[-1]
    file = await photo.get_file()
    if not os.path.exists('images'):
        os.makedirs('images')
    image_path = f"images/masterclass_{mc_id}_{int(time.time())}.jpg"
    await file.download_to_drive(image_path)

    masterclasses = load_masterclasses()
    for mc in masterclasses:
        if str(mc.get('id')) == str(mc_id):
            mc['image'] = image_path
            break
    save_masterclasses(masterclasses)

    await update.message.reply_text("📷 Фото оновлено!")
    await show_masterclasses_panel(update, context)
    return ConversationHandler.END

# Close admin panel
async def close_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.answer()
    await update.callback_query.edit_message_text("👋 Адмін панель закрита.")
    return ConversationHandler.END

async def admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /admin command"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ У вас немає прав адміністратора.")
        return
    
    # Call the existing admin panel handler
    await handle_admin_panel(update, context)

async def show_masterclasses_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать панель управления мастер-классами"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ У вас немає прав доступу до цієї панелі.")
        return
    
    # Если это callback от кнопки, нужно ответить на callback
    query = update.callback_query
    if query:
        await query.answer()
        message = query.message
        edit_message = True
    else:
        message = update.message
        edit_message = False
    
    keyboard = [
        [InlineKeyboardButton("📝 Додати майстер-клас", callback_data='add_masterclass')],
        [InlineKeyboardButton("✏️ Редагувати майстер-клас", callback_data='edit_masterclass')],
        [InlineKeyboardButton("🗑 Видалити майстер-клас", callback_data='remove_masterclass')],
        [InlineKeyboardButton("📋 Список майстер-класів", callback_data='list_masterclasses')],
        [InlineKeyboardButton("⬅️ Назад", callback_data='admin_panel')]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    text = "🎓 <b>Панель управління майстер-класами</b>\n\nВиберіть дію:"
    
    if edit_message:
        await message.edit_text(text, reply_markup=reply_markup, parse_mode='HTML')
    else:
        await message.reply_text(text, reply_markup=reply_markup, parse_mode='HTML')

async def handle_admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ У вас немає прав доступу до панелі адміністратора.")
        return
    
    # Обработка callback от кнопок
    query = update.callback_query
    if query:
        await query.answer()
        message = query.message
        edit_message = True
    else:
        message = update.message
        edit_message = False
    
    # Simplified admin panel per request: remove products, masterclasses, bot settings, and close
    keyboard = [
        [InlineKeyboardButton("👥 Управління адмінами", callback_data='admins_panel')]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    text = "👑 <b>Панель адміністратора</b>\n\nКерування доступом адміністраторів.\n"
    text += "Ваш ID: <code>{}</code>".format(update.effective_user.id)
    
    if edit_message:
        await message.edit_text(text, reply_markup=reply_markup, parse_mode='HTML')
    else:
        await message.reply_text(text, reply_markup=reply_markup, parse_mode='HTML')

async def show_admins_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать панель управления администраторами"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ У вас немає прав доступу до цієї панелі.")
        return
    
    query = update.callback_query
    if query:
        await query.answer()
        message = query.message
        edit_message = True
    else:
        message = update.message
        edit_message = False
    
    # Кнопки для управления админами
    keyboard = [
        [InlineKeyboardButton("👥 Список адмінів", callback_data='admin_list')],
        [InlineKeyboardButton("➕ Додати адміна", callback_data='admin_add')],
        [InlineKeyboardButton("➖ Видалити адміна", callback_data='admin_remove')],
        [InlineKeyboardButton("🆔 Мій ID", callback_data='show_my_id')],
        [InlineKeyboardButton("⬅️ Назад", callback_data='admin_panel')]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    text = "👥 <b>Управління адмінами</b>\n\n"
    text += "Здесь вы можете управлять списком администраторов бота.\n"
    text += "Ваш ID: <code>{}</code>".format(update.effective_user.id)
    
    if edit_message:
        await message.edit_text(text, reply_markup=reply_markup, parse_mode='HTML')
    else:
        await message.reply_text(text, reply_markup=reply_markup, parse_mode='HTML')

async def show_my_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать ID пользователя"""
    user_id = update.effective_user.id
    username = update.effective_user.username or "Без імені користувача"
    first_name = update.effective_user.first_name or ""
    last_name = update.effective_user.last_name or ""
    
    text = "👤 <b>Ваш профіль</b>\n"
    text += f"🆔 ID: <code>{user_id}</code>\n"
    text += f"👤 Ім'я: {first_name} {last_name}\n"
    text += f"🔗 @{username}" if username else ""
    
    # Добавляем кнопку "Назад" если это вызвано из админ-панели
    if update.callback_query and update.callback_query.data == 'show_my_id':
        keyboard = [
            [InlineKeyboardButton("⬅️ Назад", callback_data='admins_panel')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.callback_query.message.edit_text(text, reply_markup=reply_markup, parse_mode='HTML')
    else:
        await update.message.reply_text(text, parse_mode='HTML')

# =============== Availability (Products stock status) ===============
def load_products():
    try:
        if os.path.exists(products_file):
            with open(products_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Failed to load products: {e}")
    return []

def save_products(data: list):
    try:
        with open(products_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Failed to save products: {e}")

def availability_label(code: str) -> str:
    return 'Під замовлення' if code == 'preorder' else 'Є в наявності'

async def availability_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin panel to manage per-product availability."""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        target = update.callback_query.message if update.callback_query else update.message
        await target.reply_text("❌ У вас немає прав доступу до цієї панелі.")
        return
    if update.callback_query:
        await update.callback_query.answer()
        msg = update.callback_query.message
    else:
        msg = update.message

    products = load_products()
    if not products:
        await msg.reply_text("Список товарів порожній або файл не знайдено.")
        return

    buttons = []
    for i, p in enumerate(products):
        title = str(p.get('title', 'Без назви'))
        avail = p.get('availability')
        # Default logic mirrors frontend: custom order -> preorder; else in_stock
        if avail is None:
            if p.get('isCustomOrder') or title == 'Свічка під замовлення':
                avail = 'preorder'
            else:
                avail = 'in_stock'
        label = f"{title} — {availability_label(avail)}"
        buttons.append([InlineKeyboardButton(label, callback_data=f"availability_product:{i}")])
    buttons.append([InlineKeyboardButton("⬅️ Назад", callback_data='admin_panel')])
    await msg.reply_text("Оберіть товар для зміни наявності:", reply_markup=InlineKeyboardMarkup(buttons))

async def availability_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show controls to set availability for a specific product."""
    q = update.callback_query
    await q.answer()
    try:
        _, idx_str = q.data.split(":", 1)
        idx = int(idx_str)
    except Exception:
        await q.message.reply_text("Некоректний індекс товару")
        return
    products = load_products()
    if not (0 <= idx < len(products)):
        await q.message.reply_text("Товар не знайдено")
        return
    p = products[idx]
    title = str(p.get('title', 'Без назви'))
    avail = p.get('availability')
    if avail is None:
        if p.get('isCustomOrder') or title == 'Свічка під замовлення':
            avail = 'preorder'
        else:
            avail = 'in_stock'
    text = f"\nТовар: {title}\nПоточний статус: {availability_label(avail)}"
    kb = [
        [InlineKeyboardButton("Є в наявності", callback_data=f"availability_set:{idx}:in_stock")],
        [InlineKeyboardButton("Під замовлення", callback_data=f"availability_set:{idx}:preorder")],
        [InlineKeyboardButton("⬅️ Назад", callback_data='availability_panel')]
    ]
    await q.message.reply_text(text, reply_markup=InlineKeyboardMarkup(kb))

async def availability_set(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Persist new availability and confirm."""
    q = update.callback_query
    await q.answer()
    try:
        _, idx_str, code = q.data.split(":", 2)
        idx = int(idx_str)
    except Exception:
        await q.message.reply_text("Некоректні параметри")
        return
    products = load_products()
    if not (0 <= idx < len(products)):
        await q.message.reply_text("Товар не знайдено")
        return
    if code not in ("in_stock", "preorder"):
        await q.message.reply_text("Невідомий статус")
        return
    products[idx]['availability'] = code
    save_products(products)
    await q.message.reply_text(f"✅ Оновлено: {products[idx].get('title','Без назви')} — {availability_label(code)}")
    # Return to availability panel
    await availability_panel(update, context)

if __name__ == '__main__':
    # Start web server in a separate thread
    web_thread = threading.Thread(target=run_web_server, daemon=True)
    web_thread.start()
    
    app = ApplicationBuilder().token(TOKEN).build()

    # Conversation handler for adding products
    add_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_add, pattern="^add$")],
        states={
            TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_title)],
            CATEGORY: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_category)],
            DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_description)],
            PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_price)],
            DISCOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_discount)],
            SPECS: [
                CommandHandler("done", specs_done),
                MessageHandler(filters.TEXT & ~filters.COMMAND, get_specs),
            ],
            REVIEWS: [
                CommandHandler("done", reviews_done),
                CommandHandler("skip", reviews_done),
                MessageHandler(filters.TEXT & ~filters.COMMAND, get_reviews),
            ],
            PHOTOS: [
                MessageHandler(filters.PHOTO, get_photo),
                CommandHandler("done", finish_product)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)]
    )

    # Conversation handler for editing products
    edit_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(ask_edit, pattern="^edit$")],
        states={
            EDIT_SELECT: [CallbackQueryHandler(choose_edit_field, pattern=r'^edit:\d+$')],
            EDIT_FIELD: [CallbackQueryHandler(edit_field_prompt, pattern=r'^edit_field:.+$')],
            EDIT_VALUE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, save_new_value),
                CommandHandler('done', save_new_value),
            ],
            EDIT_PHOTO: [
                MessageHandler(filters.PHOTO, save_new_photo),
                MessageHandler(filters.TEXT & ~filters.COMMAND, save_new_photo),  # allow '/done' handling via text
                CommandHandler('done', save_new_photo),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)]
    )

    # Admin conversation handler
    admin_conversation = ConversationHandler(
        entry_points=[
            MessageHandler(filters.TEXT & filters.Regex(r'^👑 Панель адміністратора$'), handle_admin_panel),
            CallbackQueryHandler(handle_admin_panel, pattern=r'^admin_panel$'),
            CallbackQueryHandler(admin_add, pattern=r'^admin_add$'),
            CommandHandler("admin", admin)
        ],
        states={
            "AWAITING_ADMIN_ID": [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_admin_id),
                CallbackQueryHandler(handle_admin_panel, pattern=r'^admin_panel$')
            ],
        },
        fallbacks=[
            CommandHandler("cancel", cancel),
            CallbackQueryHandler(handle_admin_panel, pattern=r'^admin_panel$')
        ]
    )

    # Master class conversation handler
    masterclass_conversation = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(add_masterclass_start, pattern='^add_masterclass$'),
            CallbackQueryHandler(edit_masterclass_start, pattern='^edit_masterclass$'),
            CallbackQueryHandler(remove_masterclass_start, pattern='^remove_masterclass$'),
            CallbackQueryHandler(list_masterclasses, pattern='^list_masterclasses$'),
            CallbackQueryHandler(delete_masterclass, pattern='^delete_mc_'),
            CallbackQueryHandler(close_admin, pattern='^close_admin$'),
            CallbackQueryHandler(handle_admin_panel, pattern='^admin_panel$'),
            CallbackQueryHandler(show_masterclasses_panel, pattern='^masterclasses_panel$')
        ],
        states={
            MASTERCLASS_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, masterclass_title)],
            MASTERCLASS_DESC: [MessageHandler(filters.TEXT & ~filters.COMMAND, masterclass_desc)],
            MASTERCLASS_DURATION: [MessageHandler(filters.TEXT & ~filters.COMMAND, masterclass_duration)],
            MASTERCLASS_LEVEL: [MessageHandler(filters.TEXT & ~filters.COMMAND, masterclass_level)],
            MASTERCLASS_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, masterclass_price)],
            MASTERCLASS_IMAGE: [MessageHandler(filters.PHOTO, masterclass_image)],
            MASTERCLASS_VIDEO: [MessageHandler(filters.TEXT & ~filters.COMMAND, masterclass_video)],
            # Edit flow
            MC_EDIT_SELECT: [CallbackQueryHandler(mc_choose_edit_field, pattern=r'^mc_edit:.+$')],
            MC_EDIT_FIELD: [CallbackQueryHandler(mc_edit_field_prompt, pattern=r'^mc_field:.+:.+$')],
            MC_EDIT_VALUE: [MessageHandler(filters.TEXT & ~filters.COMMAND, mc_save_new_value)],
            MC_EDIT_PHOTO: [MessageHandler(filters.PHOTO, mc_save_new_photo)],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
    )

    # Sets (Bundles) conversation handler
    sets_conversation = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(set_add_start, pattern=r'^set_add$'),
            CallbackQueryHandler(set_edit_start, pattern=r'^set_edit$'),
            CallbackQueryHandler(set_remove_start, pattern=r'^set_remove$'),
            CallbackQueryHandler(set_list, pattern=r'^set_list$'),
            CallbackQueryHandler(set_delete_confirm, pattern=r'^set_del:\d+$'),
            CallbackQueryHandler(set_choose_edit_field, pattern=r'^set_edit_idx:\d+$'),
            CallbackQueryHandler(set_edit_field_prompt, pattern=r'^set_field:.+$'),
            CallbackQueryHandler(show_sets_panel, pattern=r'^sets_panel$'),
        ],
        states={
            # Add flow
            SET_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_title)],
            SET_DESC: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_desc)],
            SET_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_price)],
            SET_DISCOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_discount)],
            SET_ITEMS_MENU: [
                CallbackQueryHandler(set_items_menu_cb, pattern=r'^set_item_add$'),
                CallbackQueryHandler(set_items_done, pattern=r'^set_items_done$'),
            ],
            SET_ITEMS: [
                CommandHandler('done', set_items_done),
                MessageHandler(filters.TEXT & ~filters.COMMAND, set_items_add),
            ],
            SET_ITEM_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_item_title)],
            SET_ITEM_QTY: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_item_qty)],
            SET_ITEM_NOTE: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_item_note)],
            SET_ITEM_PHOTO: [
                MessageHandler(filters.PHOTO, set_item_photo_add),
                CommandHandler('done', set_item_photos_done),
            ],
            SET_PHOTOS: [
                MessageHandler(filters.PHOTO, set_photo_add),
                CommandHandler('done', set_photos_done),
            ],
            # Edit flow
            SET_EDIT_SELECT: [CallbackQueryHandler(set_choose_edit_field, pattern=r'^set_edit_idx:\d+$')],
            SET_EDIT_FIELD: [CallbackQueryHandler(set_edit_field_prompt, pattern=r'^set_field:.+$')],
            SET_EDIT_VALUE: [MessageHandler(filters.TEXT & ~filters.COMMAND, set_edit_save_value)],
            SET_EDIT_PHOTO: [
                MessageHandler(filters.PHOTO, set_edit_save_photos),
                MessageHandler(filters.TEXT & ~filters.COMMAND, set_edit_save_photos),  # handle /done text
                CommandHandler('done', set_edit_save_photos),
            ],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
    )

    # Add all handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("admin", admin))
    
    # Message handlers
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r'^📦 Меню$'), handle_menu_button))
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r'^👑 Панель адміністратора$'), handle_admin_panel))
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r'^🎓 Управління майстер-класами$'), show_masterclasses_panel))
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r'^🧩 Набори$'), show_sets_panel))
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r'^📋 Замовлення$'), orders_menu))
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r'^🆔 Мій ID$'), show_my_id))
    
    # Conversation handlers
    app.add_handler(add_handler)
    app.add_handler(edit_handler)
    app.add_handler(admin_conversation)
    app.add_handler(masterclass_conversation)
    app.add_handler(sets_conversation)
    # Preview image swap for set items
    app.add_handler(CallbackQueryHandler(set_preview_swap, pattern=r'^set_prev_item:\d+$'))
    
    # Callback query handlers
    app.add_handler(CallbackQueryHandler(list_products, pattern=r'^list$'))
    app.add_handler(CallbackQueryHandler(ask_delete, pattern=r'^delete$'))
    app.add_handler(CallbackQueryHandler(confirm_delete, pattern=r'^del:\d+$'))
    app.add_handler(CallbackQueryHandler(delete_product, pattern=r'^confirm_del$'))
    app.add_handler(CallbackQueryHandler(send_main_menu, pattern=r'^menu$'))
    # Sets panel quick access
    app.add_handler(CallbackQueryHandler(show_sets_panel, pattern=r'^sets_panel$'))
    
    # Admin panel handlers
    app.add_handler(CallbackQueryHandler(admin_remove, pattern=r'^admin_remove$'))
    app.add_handler(CallbackQueryHandler(admin_list, pattern=r'^admin_list$'))
    app.add_handler(CallbackQueryHandler(remove_admin, pattern=r'^remove_admin:\d+$'))
    app.add_handler(CallbackQueryHandler(handle_admin_panel, pattern=r'^back_to_admin$'))
    app.add_handler(CallbackQueryHandler(show_my_id, pattern=r'^show_my_id$'))
    app.add_handler(CallbackQueryHandler(show_admins_panel, pattern=r'^admins_panel$'))
    # Orders handlers
    app.add_handler(CallbackQueryHandler(orders_menu, pattern=r'^orders_menu$'))
    app.add_handler(CallbackQueryHandler(orders_list, pattern=r'^orders_list$'))
    app.add_handler(CallbackQueryHandler(order_view, pattern=r'^order_view:.+$'))
    app.add_handler(CallbackQueryHandler(order_set_status, pattern=r'^order_status:.+:.+$'))
    app.add_handler(CallbackQueryHandler(order_mark_paid, pattern=r'^order_paid:.+$'))
    app.add_handler(CallbackQueryHandler(order_mark_unpaid, pattern=r'^order_unpaid:.+$'))
    app.add_handler(CallbackQueryHandler(confirm_pending_action, pattern=r'^confirm_pending:.+$'))

    # Reviews
    app.add_handler(CallbackQueryHandler(show_reviews_menu, pattern=r'^reviews_menu$'))
    app.add_handler(CallbackQueryHandler(show_product_reviews, pattern=r'^reviews_product:\d+$'))
    app.add_handler(CallbackQueryHandler(delete_review, pattern=r'^del_review:\d+:\d+$'))
    app.add_handler(CallbackQueryHandler(clear_product_reviews, pattern=r'^clear_reviews:\d+$'))
    app.add_handler(CallbackQueryHandler(clear_all_reviews_confirm, pattern=r'^clear_all_reviews_confirm$'))
    app.add_handler(CallbackQueryHandler(clear_all_reviews, pattern=r'^clear_all_reviews$'))

    # Availability
    app.add_handler(CallbackQueryHandler(availability_panel, pattern=r'^availability_panel$'))
    app.add_handler(CallbackQueryHandler(availability_product, pattern=r'^availability_product:\d+$'))
    app.add_handler(CallbackQueryHandler(availability_set, pattern=r'^availability_set:\d+:(in_stock|preorder)$'))

    print("✅ Бот запущений")
    app.run_polling()
