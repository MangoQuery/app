#!/usr/bin/env python3
"""Generate localized Google Play Store screenshots for Mango.

Usage:
    python playstore/generate_screenshots.py              # all locales
    python playstore/generate_screenshots.py ja-JP ko-KR  # specific locales
    python playstore/generate_screenshots.py --list        # list available locales

Output: playstore/screenshots/{play_locale}/screenshot_{1-5}_{scene}.png

Requirements: pip install Pillow
"""

import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

# Add appstore/ to path so we can import shared data
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "appstore"))
from locales import (
    LOCALES, SCREENSHOT_CONFIGS,
    MANGO_ORANGE, MANGO_BG, MANGO_SIDEBAR_BG, MANGO_DARK, MANGO_GRAY,
)

# Google Play phone screenshot dimensions (16:9, standard)
W, H = 1080, 1920

# Locale mapping
PLAY_LOCALE_MAP = {
    "en-US":    "en-US",
    "de-DE":    "de-DE",
    "ja":       "ja-JP",
    "zh-Hans":  "zh-CN",
    "es-MX":    "es-419",
    "fr-FR":    "fr-FR",
    "pt-BR":    "pt-BR",
    "ko":       "ko-KR",
    "it":       "it-IT",
    "tr":       "tr-TR",
    "th":       "th",
    "id":       "id",
    "vi":       "vi",
}

REVERSE_LOCALE_MAP = {v: k for k, v in PLAY_LOCALE_MAP.items()}

# Perry locale → App Store locale mapping
PERRY_TO_APPSTORE = {
    "en": "en-US", "de": "de-DE", "ja": "ja", "zh-Hans": "zh-Hans",
    "es-MX": "es-MX", "fr": "fr-FR", "pt": "pt-BR", "ko": "ko",
    "it": "it", "tr": "tr", "th": "th", "id": "id", "vi": "vi",
}
APPSTORE_TO_PERRY = {v: k for k, v in PERRY_TO_APPSTORE.items()}

# Load app locale strings
APP_LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "locales")


def load_app_strings(appstore_locale):
    perry_locale = APPSTORE_TO_PERRY.get(appstore_locale, "en")
    path = os.path.join(APP_LOCALES_DIR, f"{perry_locale}.json")
    if not os.path.exists(path):
        path = os.path.join(APP_LOCALES_DIR, "en.json")
    with open(path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Font resolution
# ---------------------------------------------------------------------------

SF_FONTS = {
    "heavy":   "/Library/Fonts/SF-Pro-Display-Heavy.otf",
    "bold":    "/Library/Fonts/SF-Pro-Display-Bold.otf",
    "medium":  "/Library/Fonts/SF-Pro-Display-Medium.otf",
    "regular": "/Library/Fonts/SF-Pro-Display-Regular.otf",
    "light":   "/Library/Fonts/SF-Pro-Display-Light.otf",
}

SF_MONO = {
    "regular": "/Library/Fonts/SF-Mono-Regular.otf",
    "medium":  "/Library/Fonts/SF-Mono-Medium.otf",
    "bold":    "/Library/Fonts/SF-Mono-Bold.otf",
}

CJK_FONT_CANDIDATES = {
    "ja": [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
        "/System/Library/Fonts/Hiragino Sans W6.ttc",
        "/Library/Fonts/NotoSansCJKjp-Bold.otf",
    ],
    "zh-Hans": [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/Library/Fonts/NotoSansCJKsc-Bold.otf",
    ],
    "ko": [
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/Library/Fonts/NotoSansCJKkr-Bold.otf",
    ],
    "th": [
        "/System/Library/Fonts/Supplemental/Thonburi.ttc",
        "/System/Library/Fonts/ThonburiUI.ttc",
        "/System/Library/Fonts/Thonburi.ttc",
        "/Library/Fonts/NotoSansThai-Bold.ttf",
    ],
}


def find_font(candidates):
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def get_font(script, weight, size):
    if script == "latin":
        path = SF_FONTS.get(weight, SF_FONTS["regular"])
        if os.path.exists(path):
            return ImageFont.truetype(path, size)

    if script in CJK_FONT_CANDIDATES:
        path = find_font(CJK_FONT_CANDIDATES[script])
        if path:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass

    sf_path = SF_FONTS.get(weight, SF_FONTS["regular"])
    if os.path.exists(sf_path):
        try:
            return ImageFont.truetype(sf_path, size)
        except Exception:
            pass

    print(f"  Warning: no font found for script={script}, using default")
    return ImageFont.load_default()


def get_mono_font(size):
    for weight in ["regular", "medium"]:
        path = SF_MONO.get(weight)
        if path and os.path.exists(path):
            return ImageFont.truetype(path, size)
    return get_font("latin", "regular", size)


# ---------------------------------------------------------------------------
# Scale factor relative to iOS (1284x2778)
# ---------------------------------------------------------------------------

S = W / 1284


def scaled(val):
    return int(val * S)


# ---------------------------------------------------------------------------
# Drawing helpers (scaled versions of appstore generator)
# ---------------------------------------------------------------------------

def draw_status_bar(draw, phone_x, phone_y, phone_w, script):
    time_font = get_font(script, "bold", scaled(34))
    draw.text((phone_x + scaled(80), phone_y + scaled(30)), "9:41", font=time_font, fill=MANGO_DARK)
    bx = phone_x + phone_w - scaled(140)
    by = phone_y + scaled(38)
    draw.rounded_rectangle([bx, by, bx + scaled(50), by + scaled(22)], radius=3, outline=MANGO_DARK, width=2)
    draw.rectangle([bx + scaled(50), by + scaled(6), bx + scaled(54), by + scaled(16)], fill=MANGO_DARK)
    draw.rounded_rectangle([bx + 3, by + 3, bx + scaled(40), by + scaled(19)], radius=2, fill=(76, 217, 100))


def draw_nav_bar(draw, x, y, w, items, active_idx, script):
    font = get_font(script, "medium", scaled(30))
    spacing = w // len(items)
    for i, item in enumerate(items):
        color = MANGO_ORANGE if i == active_idx else MANGO_GRAY
        bbox = draw.textbbox((0, 0), item, font=font)
        tw = bbox[2] - bbox[0]
        ix = x + i * spacing + (spacing - tw) // 2
        draw.text((ix, y), item, font=font, fill=color)


def draw_sidebar_item(draw, x, y, w, text, expanded, script, active=False):
    font = get_font(script, "regular", scaled(28))
    arrow = "v " if expanded else "> "
    color = MANGO_ORANGE if active else MANGO_DARK
    if active:
        draw.rounded_rectangle([x, y - scaled(4), x + w, y + scaled(36)], radius=scaled(6), fill=(242, 148, 46, 30))
    draw.text((x + scaled(12), y), arrow + text, font=font, fill=color)
    return y + scaled(44)


def draw_document_card(draw, x, y, w, fields, doc_id, script):
    card_h = scaled(36) + len(fields) * scaled(32) + scaled(20)
    draw.rounded_rectangle([x, y, x + w, y + card_h], radius=scaled(12), fill=(255, 255, 255), outline=(230, 225, 218), width=2)

    font_mono = get_mono_font(scaled(22))
    font_label = get_font(script, "regular", scaled(22))
    font_edit = get_font(script, "medium", scaled(24))

    draw.text((x + scaled(16), y + scaled(10)), doc_id, font=font_mono, fill=MANGO_GRAY)
    edit_text = "Edit"
    eb = draw.textbbox((0, 0), edit_text, font=font_edit)
    draw.text((x + w - scaled(16) - (eb[2] - eb[0]), y + scaled(10)), edit_text, font=font_edit, fill=MANGO_ORANGE)

    fy = y + scaled(42)
    for key, val in fields:
        draw.text((x + scaled(16), fy), key, font=font_label, fill=MANGO_GRAY)
        vb = draw.textbbox((0, 0), val, font=font_label)
        draw.text((x + w - scaled(16) - (vb[2] - vb[0]), fy), val, font=font_label, fill=MANGO_DARK)
        fy += scaled(32)

    return y + card_h + scaled(12)


# ---------------------------------------------------------------------------
# Scene renderers (scaled versions)
# ---------------------------------------------------------------------------

def render_welcome(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    cx = phone_x + phone_w // 2

    title_font = get_font(script, "heavy", scaled(56))
    tagline_font = get_font(script, "regular", scaled(28))
    btn_font = get_font(script, "bold", scaled(30))

    icon_y = phone_y + scaled(200)
    icon_r = scaled(60)
    draw.ellipse([cx - icon_r, icon_y, cx + icon_r, icon_y + icon_r * 2], fill=MANGO_ORANGE)
    draw.ellipse([cx - scaled(8), icon_y - scaled(10), cx + scaled(20), icon_y + scaled(18)], fill=(100, 180, 60))

    title = strings.get("Welcome to Mango", "Welcome to Mango")
    tb = draw.textbbox((0, 0), title, font=title_font)
    tw = tb[2] - tb[0]
    f = title_font
    if tw > phone_w - scaled(80):
        shrink = int(scaled(56) * (phone_w - scaled(80)) / tw)
        f = get_font(script, "heavy", max(20, shrink))
        tb = draw.textbbox((0, 0), title, font=f)
        tw = tb[2] - tb[0]
    draw.text((cx - tw // 2, icon_y + icon_r * 2 + scaled(40)), title, font=f, fill=MANGO_DARK)

    tagline = strings.get("MongoDB, finally fast.", "MongoDB, finally fast.")
    tb2 = draw.textbbox((0, 0), tagline, font=tagline_font)
    tw2 = tb2[2] - tb2[0]
    draw.text((cx - tw2 // 2, icon_y + icon_r * 2 + scaled(110)), tagline, font=tagline_font, fill=MANGO_GRAY)

    pill_font = get_font(script, "medium", scaled(22))
    pills = [
        strings.get("Databases & Collections", "Databases & Collections"),
        strings.get("Query & Filter", "Query & Filter"),
        strings.get("Edit & Insert", "Edit & Insert"),
        strings.get("Index Viewer", "Index Viewer"),
    ]
    pill_y = icon_y + icon_r * 2 + scaled(180)
    for pill_text in pills:
        pb = draw.textbbox((0, 0), pill_text, font=pill_font)
        pw = pb[2] - pb[0] + scaled(32)
        px = cx - pw // 2
        draw.rounded_rectangle([px, pill_y, px + pw, pill_y + scaled(40)], radius=scaled(20), fill=(255, 244, 230))
        draw.text((px + scaled(16), pill_y + scaled(8)), pill_text, font=pill_font, fill=MANGO_ORANGE)
        pill_y += scaled(52)

    btn_text = strings.get("+ New Connection", "+ New Connection")
    bb = draw.textbbox((0, 0), btn_text, font=btn_font)
    bw = bb[2] - bb[0] + scaled(60)
    bx = cx - bw // 2
    by = pill_y + scaled(40)
    draw.rounded_rectangle([bx, by, bx + bw, by + scaled(56)], radius=scaled(28), fill=MANGO_ORANGE)
    draw.text((bx + scaled(30), by + scaled(12)), btn_text, font=btn_font, fill=(255, 255, 255))

    card_font = get_font(script, "regular", scaled(26))
    card_y = by + scaled(90)
    connections = ["Production", "Staging", "Local dev"]
    for conn in connections:
        if card_y + scaled(60) > phone_y + phone_h - scaled(40):
            break
        draw.rounded_rectangle(
            [phone_x + scaled(40), card_y, phone_x + phone_w - scaled(40), card_y + scaled(56)],
            radius=scaled(12), fill=(255, 255, 255), outline=(230, 225, 218), width=2,
        )
        draw.text((phone_x + scaled(60), card_y + scaled(14)), conn, font=card_font, fill=MANGO_DARK)
        ct = strings.get("Connect", "Connect")
        cb = draw.textbbox((0, 0), ct, font=card_font)
        cw = cb[2] - cb[0]
        draw.text((phone_x + phone_w - scaled(60) - cw, card_y + scaled(14)), ct, font=card_font, fill=MANGO_ORANGE)
        card_y += scaled(72)


def render_browse(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    sidebar_w = int(phone_w * 0.32)
    content_x = phone_x + sidebar_w
    content_w = phone_w - sidebar_w

    draw.rectangle([phone_x, phone_y + scaled(80), phone_x + sidebar_w, phone_y + phone_h], fill=MANGO_SIDEBAR_BG)

    nav_items = [strings.get("Explorer", "Explorer"), "test1", strings.get("About", "About")]
    draw_nav_bar(draw, phone_x, phone_y + scaled(90), phone_w, nav_items, 0, script)

    sidebar_font = get_font(script, "bold", scaled(30))
    draw.text((phone_x + scaled(16), phone_y + scaled(140)), strings.get("Explorer", "Explorer"), font=sidebar_font, fill=MANGO_DARK)

    y = phone_y + scaled(190)
    databases = [
        ("admin", False, []),
        ("config", False, []),
        ("shop_db", True, ["customers", "orders", "products", "inventory"]),
        ("analytics", False, []),
    ]
    coll_font = get_font(script, "regular", scaled(24))
    for db_name, expanded, collections in databases:
        y = draw_sidebar_item(draw, phone_x + scaled(8), y, sidebar_w - scaled(16), db_name, expanded, script)
        if expanded:
            for coll in collections:
                if y + scaled(36) > phone_y + phone_h - scaled(20):
                    break
                active = coll == "customers"
                color = MANGO_ORANGE if active else MANGO_GRAY
                draw.text((phone_x + scaled(48), y), coll, font=coll_font, fill=color)
                y += scaled(36)

    refresh_font = get_font(script, "medium", scaled(24))
    draw.text((phone_x + scaled(24), y + scaled(12)), strings.get("Refresh", "Refresh"), font=refresh_font, fill=MANGO_ORANGE)

    header_font = get_font(script, "medium", scaled(26))
    draw.text((content_x + scaled(20), phone_y + scaled(140)), "shop_db.customers", font=header_font, fill=MANGO_ORANGE)
    doc_count = "4 " + strings.get("documents", "documents")
    draw.text((content_x + scaled(280), phone_y + scaled(140)), doc_count, font=get_font(script, "regular", scaled(24)), fill=MANGO_GRAY)

    docs = [
        ("69b26f...63b1", [("name", "Alice"), ("email", "alice@example.com"), ("age", "30"), ("role", "admin")]),
        ("69b26f...63b2", [("name", "Bob"), ("email", "bob@example.com"), ("age", "25"), ("role", "user")]),
        ("69b26f...63b3", [("name", "Charlie"), ("email", "charlie@ex.com"), ("age", "35"), ("role", "editor")]),
    ]
    cy = phone_y + scaled(180)
    for doc_id, fields in docs:
        if cy + scaled(200) > phone_y + phone_h - scaled(20):
            break
        cy = draw_document_card(draw, content_x + scaled(16), cy, content_w - scaled(32), fields, doc_id, script)


def render_query(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    sidebar_w = int(phone_w * 0.32)
    content_x = phone_x + sidebar_w
    content_w = phone_w - sidebar_w

    draw.rectangle([phone_x, phone_y + scaled(80), phone_x + sidebar_w, phone_y + phone_h], fill=MANGO_SIDEBAR_BG)

    nav_items = [strings.get("Explorer", "Explorer"), "prod", strings.get("About", "About")]
    draw_nav_bar(draw, phone_x, phone_y + scaled(90), phone_w, nav_items, 0, script)

    y = phone_y + scaled(150)
    sidebar_font = get_font(script, "bold", scaled(30))
    draw.text((phone_x + scaled(16), y), strings.get("Explorer", "Explorer"), font=sidebar_font, fill=MANGO_DARK)
    y += scaled(50)
    for db in ["admin", "config", "users_db"]:
        y = draw_sidebar_item(draw, phone_x + scaled(8), y, sidebar_w - scaled(16), db, False, script)

    qy = phone_y + scaled(140)
    label_font = get_font(script, "regular", scaled(22))
    input_font = get_font(script, "regular", scaled(28))
    btn_font = get_font(script, "bold", scaled(28))

    draw.text((content_x + scaled(20), qy), strings.get("Query", "Query"), font=get_font(script, "bold", scaled(30)), fill=MANGO_DARK)
    draw.text((content_x + scaled(20), qy + scaled(44)), strings.get("Database . Collection", "Database . Collection"), font=label_font, fill=MANGO_GRAY)

    qy += scaled(70)
    draw.rounded_rectangle([content_x + scaled(20), qy, content_x + content_w - scaled(20), qy + scaled(44)], radius=scaled(4), fill=(255, 255, 255), outline=(210, 205, 198), width=2)
    draw.text((content_x + scaled(32), qy + scaled(8)), "users_db", font=input_font, fill=MANGO_DARK)

    qy += scaled(56)
    draw.rounded_rectangle([content_x + scaled(20), qy, content_x + content_w - scaled(20), qy + scaled(44)], radius=scaled(4), fill=(255, 255, 255), outline=(210, 205, 198), width=2)
    draw.text((content_x + scaled(32), qy + scaled(8)), "profiles", font=input_font, fill=MANGO_DARK)

    qy += scaled(56)
    draw.text((content_x + scaled(20), qy), strings.get("Filter", "Filter"), font=label_font, fill=MANGO_GRAY)
    qy += scaled(28)
    draw.rounded_rectangle([content_x + scaled(20), qy, content_x + content_w - scaled(20), qy + scaled(44)], radius=scaled(4), fill=(255, 255, 255), outline=(210, 205, 198), width=2)
    draw.text((content_x + scaled(32), qy + scaled(8)), '{ "role": "admin" }', font=get_mono_font(scaled(24)), fill=MANGO_DARK)

    qy += scaled(60)
    draw.text((content_x + scaled(20), qy + scaled(8)), "users_db.profiles", font=get_font(script, "medium", scaled(24)), fill=MANGO_ORANGE)
    run_text = strings.get("Run Query", "Run Query")
    rb = draw.textbbox((0, 0), run_text, font=btn_font)
    rw = rb[2] - rb[0] + scaled(40)
    rx = content_x + content_w - scaled(20) - rw
    draw.rounded_rectangle([rx, qy, rx + rw, qy + scaled(44)], radius=scaled(8), fill=MANGO_ORANGE)
    draw.text((rx + scaled(20), qy + scaled(8)), run_text, font=btn_font, fill=(255, 255, 255))

    qy += scaled(64)
    result_header = "users_db.profiles   2 " + strings.get("documents", "documents")
    draw.text((content_x + scaled(20), qy), result_header, font=get_font(script, "regular", scaled(24)), fill=MANGO_GRAY)
    qy += scaled(36)

    docs = [
        ("5f4d8a...a1b2", [("name", "Sarah Chen"), ("role", "admin"), ("active", "true")]),
        ("5f4d8a...c3d4", [("name", "James Park"), ("role", "admin"), ("active", "true")]),
    ]
    for doc_id, fields in docs:
        if qy + scaled(180) > phone_y + phone_h - scaled(20):
            break
        qy = draw_document_card(draw, content_x + scaled(16), qy, content_w - scaled(32), fields, doc_id, script)


def render_edit(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    pad = scaled(40)

    back_text = strings.get("< Back", "< Back")
    nav_font = get_font(script, "medium", scaled(30))
    draw.text((phone_x + pad, phone_y + scaled(96)), back_text, font=nav_font, fill=MANGO_ORANGE)

    title = strings.get("Edit Document", "Edit Document")
    title_font = get_font(script, "bold", scaled(36))
    draw.text((phone_x + pad, phone_y + scaled(150)), title, font=title_font, fill=MANGO_DARK)

    editor_y = phone_y + scaled(210)
    editor_h = phone_h - scaled(340)
    draw.rounded_rectangle(
        [phone_x + pad, editor_y, phone_x + phone_w - pad, editor_y + editor_h],
        radius=scaled(12), fill=(255, 255, 255), outline=(230, 225, 218), width=2,
    )

    mono = get_mono_font(scaled(24))
    json_lines = [
        '{',
        '  "name": "Alice Johnson",',
        '  "email": "alice@example.com",',
        '  "age": 30,',
        '  "role": "admin",',
        '  "department": "Engineering",',
        '  "active": true,',
        '  "permissions": [',
        '    "read",',
        '    "write",',
        '    "delete"',
        '  ],',
        '  "lastLogin": "2025-03-15T...',
        '}',
    ]

    jy = editor_y + scaled(16)
    for i, line in enumerate(json_lines):
        if jy + scaled(30) > editor_y + editor_h - scaled(16):
            break
        ln = str(i + 1).rjust(2)
        draw.text((phone_x + pad + scaled(12), jy), ln, font=mono, fill=(180, 180, 180))
        draw.text((phone_x + pad + scaled(52), jy), line, font=mono, fill=MANGO_DARK)
        jy += scaled(32)

    save_text = strings.get("Save Changes", "Save Changes")
    save_font = get_font(script, "bold", scaled(32))
    sb = draw.textbbox((0, 0), save_text, font=save_font)
    sw = sb[2] - sb[0] + scaled(60)
    sx = phone_x + (phone_w - sw) // 2
    sy = editor_y + editor_h + scaled(24)
    draw.rounded_rectangle([sx, sy, sx + sw, sy + scaled(56)], radius=scaled(28), fill=MANGO_ORANGE)
    draw.text((sx + scaled(30), sy + scaled(12)), save_text, font=save_font, fill=(255, 255, 255))


def render_native(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    cx = phone_x + phone_w // 2

    icon_y = phone_y + scaled(180)
    icon_r = scaled(80)
    draw.ellipse([cx - icon_r, icon_y, cx + icon_r, icon_y + icon_r * 2], fill=MANGO_ORANGE)
    draw.ellipse([cx - scaled(10), icon_y - scaled(14), cx + scaled(26), icon_y + scaled(22)], fill=(100, 180, 60))

    name_font = get_font(script, "heavy", scaled(72))
    name = "Mango"
    nb = draw.textbbox((0, 0), name, font=name_font)
    nw = nb[2] - nb[0]
    draw.text((cx - nw // 2, icon_y + icon_r * 2 + scaled(50)), name, font=name_font, fill=MANGO_DARK)

    tagline = strings.get("MongoDB, finally fast.", "MongoDB, finally fast.")
    tag_font = get_font(script, "regular", scaled(32))
    tb = draw.textbbox((0, 0), tagline, font=tag_font)
    tw = tb[2] - tb[0]
    draw.text((cx - tw // 2, icon_y + icon_r * 2 + scaled(140)), tagline, font=tag_font, fill=MANGO_GRAY)

    feature_font = get_font(script, "medium", scaled(28))
    check_color = (76, 180, 76)
    features = [
        "macOS, iOS, Android, Linux, Windows",
        "SCRAM-SHA-256 + TLS",
        strings.get("Databases & Collections", "Databases & Collections"),
        strings.get("Query & Filter", "Query & Filter"),
        strings.get("Edit & Insert", "Edit & Insert"),
        strings.get("Index Viewer", "Index Viewer"),
    ]
    fy = icon_y + icon_r * 2 + scaled(220)
    for feat in features:
        if fy + scaled(46) > phone_y + phone_h - scaled(80):
            break
        draw.text((phone_x + scaled(80), fy), "\u2713", font=feature_font, fill=check_color)
        fb = draw.textbbox((0, 0), feat, font=feature_font)
        fw = fb[2] - fb[0]
        f = feature_font
        if fw > phone_w - scaled(160):
            shrink = int(scaled(28) * (phone_w - scaled(160)) / fw)
            f = get_font(script, "medium", max(14, shrink))
        draw.text((phone_x + scaled(120), fy), feat, font=f, fill=MANGO_DARK)
        fy += scaled(46)

    bottom_font = get_font(script, "bold", scaled(26))
    bottom = "skelpo.com"
    bb = draw.textbbox((0, 0), bottom, font=bottom_font)
    bw = bb[2] - bb[0]
    draw.text((cx - bw // 2, phone_y + phone_h - scaled(70)), bottom, font=bottom_font, fill=MANGO_GRAY)


SCENE_RENDERERS = {
    "welcome": render_welcome,
    "browse": render_browse,
    "query": render_query,
    "edit": render_edit,
    "native": render_native,
}


# ---------------------------------------------------------------------------
# Screenshot creation
# ---------------------------------------------------------------------------

def load_raw_screenshot(appstore_locale, config):
    """Try to load a raw simulator screenshot for this locale and scene."""
    # Try iOS raw screenshots (also used for Play Store until Android captures exist)
    raw_dir = os.path.join(os.path.dirname(__file__), "..", "screenshots", "raw", "ios", appstore_locale)
    raw_path = os.path.join(raw_dir, f"screenshot_{config['suffix']}.png")
    if os.path.exists(raw_path):
        return Image.open(raw_path)
    return None


def create_screenshot(config, screenshot_text, script, strings, appstore_locale=None, force_mock=False):
    bg_color = (18, 18, 18)
    img = Image.new("RGB", (W, H), bg_color)
    draw = ImageDraw.Draw(img)

    caption_font = get_font(script, "heavy", scaled(72))
    caption = screenshot_text["caption"]
    lines = caption.split("\n")
    caption_y = scaled(180)
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=caption_font)
        tw = bbox[2] - bbox[0]
        font = caption_font
        if tw > W - scaled(100):
            shrink_size = int(scaled(72) * (W - scaled(100)) / tw)
            font = get_font(script, "heavy", max(20, shrink_size))
            bbox = draw.textbbox((0, 0), line, font=font)
            tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, caption_y), line, font=font, fill=(255, 255, 255))
        caption_y += scaled(90)

    phone_x = scaled(92)
    phone_y = caption_y + scaled(80)
    phone_w = W - scaled(184)
    phone_h = H - phone_y - scaled(120)
    phone_r = scaled(60)

    # Try real screenshot first, fall back to mock rendering
    raw_img = None
    if not force_mock and appstore_locale:
        raw_img = load_raw_screenshot(appstore_locale, config)

    if raw_img:
        raw_img = raw_img.resize((phone_w, phone_h), Image.LANCZOS)
        mask = Image.new("L", (phone_w, phone_h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, phone_w, phone_h], radius=phone_r, fill=255)
        img.paste(raw_img, (phone_x, phone_y), mask)
        draw.rounded_rectangle(
            [phone_x, phone_y, phone_x + phone_w, phone_y + phone_h],
            radius=phone_r, outline=(80, 80, 80), width=2,
        )
    else:
        draw.rounded_rectangle(
            [phone_x, phone_y, phone_x + phone_w, phone_y + phone_h],
            radius=phone_r, fill=MANGO_BG, outline=(200, 195, 185), width=2,
        )
        draw_status_bar(draw, phone_x, phone_y, phone_w, script)
        scene = config["scene"]
        renderer = SCENE_RENDERERS.get(scene)
        if renderer:
            renderer(draw, img, phone_x, phone_y + scaled(70), phone_w, phone_h - scaled(70), strings, script)

    return img


def generate_locale(appstore_locale, locale_data, out_base, force_mock=False):
    play_locale = PLAY_LOCALE_MAP[appstore_locale]
    script = locale_data["script"]
    screenshots = locale_data["screenshots"]
    strings = load_app_strings(appstore_locale)
    out_dir = os.path.join(out_base, play_locale)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n=== {play_locale} ({locale_data['name']}) ===")

    for config, text in zip(SCREENSHOT_CONFIGS, screenshots):
        filename = f"screenshot_{config['suffix']}.png"
        print(f"  Generating {filename}...")
        img = create_screenshot(config, text, script, strings, appstore_locale, force_mock)
        img.save(os.path.join(out_dir, filename), "PNG")

    print(f"  -> {len(SCREENSHOT_CONFIGS)} screenshots saved to {out_dir}/")


def resolve_locale(code):
    if code in LOCALES:
        return code
    if code in REVERSE_LOCALE_MAP:
        return REVERSE_LOCALE_MAP[code]
    return None


def main():
    parser = argparse.ArgumentParser(description="Generate localized Google Play screenshots")
    parser.add_argument("locales", nargs="*", help="Locale codes to generate (default: all)")
    parser.add_argument("--list", action="store_true", help="List available locales")
    parser.add_argument("--out", default=None, help="Output base directory (default: playstore/screenshots)")
    parser.add_argument("--mock", action="store_true", help="Force mock rendering (ignore raw captures)")
    args = parser.parse_args()

    if args.list:
        for appstore_code, play_code in PLAY_LOCALE_MAP.items():
            name = LOCALES[appstore_code]["name"]
            print(f"  {play_code:10s}  ({appstore_code:10s})  {name}")
        return

    out_base = args.out or os.path.join(os.path.dirname(__file__), "screenshots")

    if args.locales:
        target_locales = []
        for code in args.locales:
            resolved = resolve_locale(code)
            if resolved is None:
                print(f"Error: unknown locale '{code}'. Use --list to see available locales.")
                sys.exit(1)
            target_locales.append(resolved)
    else:
        target_locales = list(PLAY_LOCALE_MAP.keys())

    print(f"Generating screenshots for {len(target_locales)} locale(s)...")
    print(f"Output: {out_base}/")
    print(f"Size: {W}x{H} (Google Play phone)")

    for loc in target_locales:
        generate_locale(loc, LOCALES[loc], out_base, force_mock=args.mock)

    total = len(target_locales) * len(SCREENSHOT_CONFIGS)
    print(f"\nDone! {total} screenshots generated.")


if __name__ == "__main__":
    main()
