#!/usr/bin/env python3
"""Generate localized App Store screenshots for Mango.

Composites real simulator screenshots (from screenshots/raw/ios/) into
marketing frames with localized captions. Falls back to mock rendering
if raw screenshots are not available.

Usage:
    python appstore/generate_screenshots.py              # all locales
    python appstore/generate_screenshots.py de-DE ja     # specific locales
    python appstore/generate_screenshots.py --list       # list available locales
    python appstore/generate_screenshots.py --mock       # force mock rendering

Output: appstore/screenshots/{locale}/screenshot_{1-5}_{scene}.png

Requirements: pip install Pillow
"""

import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

from locales import LOCALES, SCREENSHOT_CONFIGS, MANGO_ORANGE, MANGO_BG, MANGO_SIDEBAR_BG, MANGO_DARK, MANGO_GRAY

# Screenshot dimensions (iPhone 14 Pro Max / 15 Pro Max)
W, H = 1284, 2778

# Load app locale strings for in-phone UI text
APP_LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "locales")

# Perry locale → App Store locale mapping
PERRY_TO_APPSTORE = {
    "en": "en-US", "de": "de-DE", "ja": "ja", "zh-Hans": "zh-Hans",
    "es-MX": "es-MX", "fr": "fr-FR", "pt": "pt-BR", "ko": "ko",
    "it": "it", "tr": "tr", "th": "th", "id": "id", "vi": "vi",
}
APPSTORE_TO_PERRY = {v: k for k, v in PERRY_TO_APPSTORE.items()}


def load_app_strings(appstore_locale):
    """Load the app's translation strings for a locale."""
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
# Drawing helpers
# ---------------------------------------------------------------------------

def draw_rounded_rect(draw, bbox, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)


def draw_status_bar(draw, phone_x, phone_y, phone_w, script):
    """Draw a phone status bar."""
    time_font = get_font(script, "bold", 34)
    draw.text((phone_x + 80, phone_y + 30), "9:41", font=time_font, fill=MANGO_DARK)
    # Battery
    bx = phone_x + phone_w - 140
    by = phone_y + 38
    draw.rounded_rectangle([bx, by, bx + 50, by + 22], radius=4, outline=MANGO_DARK, width=2)
    draw.rectangle([bx + 50, by + 6, bx + 54, by + 16], fill=MANGO_DARK)
    draw.rounded_rectangle([bx + 3, by + 3, bx + 40, by + 19], radius=2, fill=(76, 217, 100))


def draw_nav_bar(draw, x, y, w, items, active_idx, script):
    """Draw a navigation bar with items."""
    font = get_font(script, "medium", 30)
    spacing = w // len(items)
    for i, item in enumerate(items):
        color = MANGO_ORANGE if i == active_idx else MANGO_GRAY
        bbox = draw.textbbox((0, 0), item, font=font)
        tw = bbox[2] - bbox[0]
        ix = x + i * spacing + (spacing - tw) // 2
        draw.text((ix, y), item, font=font, fill=color)


def draw_sidebar_item(draw, x, y, w, text, expanded, script, active=False):
    """Draw a sidebar database/collection item."""
    font = get_font(script, "regular", 28)
    arrow = "v " if expanded else "> "
    color = MANGO_ORANGE if active else MANGO_DARK
    if active:
        draw.rounded_rectangle([x, y - 4, x + w, y + 36], radius=6, fill=(242, 148, 46, 30))
    draw.text((x + 12, y), arrow + text, font=font, fill=color)
    return y + 44


def draw_document_card(draw, x, y, w, fields, doc_id, script):
    """Draw a document card with key-value pairs."""
    card_h = 36 + len(fields) * 32 + 20
    draw.rounded_rectangle([x, y, x + w, y + card_h], radius=12, fill=(255, 255, 255), outline=(230, 225, 218), width=2)

    font_mono = get_mono_font(22)
    font_label = get_font(script, "regular", 22)
    font_edit = get_font(script, "medium", 24)

    # Doc ID + Edit button
    draw.text((x + 16, y + 10), doc_id, font=font_mono, fill=MANGO_GRAY)
    edit_text = "Edit"
    eb = draw.textbbox((0, 0), edit_text, font=font_edit)
    draw.text((x + w - 16 - (eb[2] - eb[0]), y + 10), edit_text, font=font_edit, fill=MANGO_ORANGE)

    # Fields
    fy = y + 42
    for key, val in fields:
        draw.text((x + 16, fy), key, font=font_label, fill=MANGO_GRAY)
        vb = draw.textbbox((0, 0), val, font=font_label)
        draw.text((x + w - 16 - (vb[2] - vb[0]), fy), val, font=font_label, fill=MANGO_DARK)
        fy += 32

    return y + card_h + 12


# ---------------------------------------------------------------------------
# Scene renderers
# ---------------------------------------------------------------------------

def render_welcome(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    """Render the welcome/connection screen."""
    cx = phone_x + phone_w // 2

    # App title
    title_font = get_font(script, "heavy", 56)
    tagline_font = get_font(script, "regular", 28)
    btn_font = get_font(script, "bold", 30)

    # Mango icon placeholder (orange circle)
    icon_y = phone_y + 200
    icon_r = 60
    draw.ellipse([cx - icon_r, icon_y, cx + icon_r, icon_y + icon_r * 2], fill=MANGO_ORANGE)
    # Leaf shape on the icon
    draw.ellipse([cx - 8, icon_y - 10, cx + 20, icon_y + 18], fill=(100, 180, 60))

    # Title
    title = strings.get("Welcome to Mango", "Welcome to Mango")
    tb = draw.textbbox((0, 0), title, font=title_font)
    tw = tb[2] - tb[0]
    f = title_font
    if tw > phone_w - 80:
        shrink = int(56 * (phone_w - 80) / tw)
        f = get_font(script, "heavy", shrink)
        tb = draw.textbbox((0, 0), title, font=f)
        tw = tb[2] - tb[0]
    draw.text((cx - tw // 2, icon_y + icon_r * 2 + 40), title, font=f, fill=MANGO_DARK)

    # Tagline
    tagline = strings.get("MongoDB, finally fast.", "MongoDB, finally fast.")
    tb2 = draw.textbbox((0, 0), tagline, font=tagline_font)
    tw2 = tb2[2] - tb2[0]
    draw.text((cx - tw2 // 2, icon_y + icon_r * 2 + 110), tagline, font=tagline_font, fill=MANGO_GRAY)

    # Feature pills
    pill_font = get_font(script, "medium", 22)
    pills = [
        strings.get("Databases & Collections", "Databases & Collections"),
        strings.get("Query & Filter", "Query & Filter"),
        strings.get("Edit & Insert", "Edit & Insert"),
        strings.get("Index Viewer", "Index Viewer"),
    ]
    pill_y = icon_y + icon_r * 2 + 180
    for pill_text in pills:
        pb = draw.textbbox((0, 0), pill_text, font=pill_font)
        pw = pb[2] - pb[0] + 32
        px = cx - pw // 2
        draw.rounded_rectangle([px, pill_y, px + pw, pill_y + 40], radius=20, fill=(255, 244, 230))
        draw.text((px + 16, pill_y + 8), pill_text, font=pill_font, fill=MANGO_ORANGE)
        pill_y += 52

    # CTA button
    btn_text = strings.get("+ New Connection", "+ New Connection")
    bb = draw.textbbox((0, 0), btn_text, font=btn_font)
    bw = bb[2] - bb[0] + 60
    bx = cx - bw // 2
    by = pill_y + 40
    draw.rounded_rectangle([bx, by, bx + bw, by + 56], radius=28, fill=MANGO_ORANGE)
    draw.text((bx + 30, by + 12), btn_text, font=btn_font, fill=(255, 255, 255))

    # Connection cards below
    card_font = get_font(script, "regular", 26)
    card_y = by + 90
    connections = ["Production", "Staging", "Local dev"]
    for conn in connections:
        if card_y + 60 > phone_y + phone_h - 40:
            break
        draw.rounded_rectangle(
            [phone_x + 40, card_y, phone_x + phone_w - 40, card_y + 56],
            radius=12, fill=(255, 255, 255), outline=(230, 225, 218), width=2,
        )
        draw.text((phone_x + 60, card_y + 14), conn, font=card_font, fill=MANGO_DARK)
        # Connect button
        ct = strings.get("Connect", "Connect")
        cb = draw.textbbox((0, 0), ct, font=card_font)
        cw = cb[2] - cb[0]
        draw.text((phone_x + phone_w - 60 - cw, card_y + 14), ct, font=card_font, fill=MANGO_ORANGE)
        card_y += 72


def render_browse(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    """Render the database browser with sidebar and document list."""
    sidebar_w = int(phone_w * 0.32)
    content_x = phone_x + sidebar_w
    content_w = phone_w - sidebar_w

    # Sidebar background
    draw.rectangle([phone_x, phone_y + 80, phone_x + sidebar_w, phone_y + phone_h], fill=MANGO_SIDEBAR_BG)

    # Nav bar
    nav_items = [strings.get("Explorer", "Explorer"), "test1", strings.get("About", "About")]
    draw_nav_bar(draw, phone_x, phone_y + 90, phone_w, nav_items, 0, script)

    # Sidebar title
    sidebar_font = get_font(script, "bold", 30)
    draw.text((phone_x + 16, phone_y + 140), strings.get("Explorer", "Explorer"), font=sidebar_font, fill=MANGO_DARK)

    # Database items
    y = phone_y + 190
    databases = [
        ("admin", False, []),
        ("config", False, []),
        ("shop_db", True, ["customers", "orders", "products", "inventory"]),
        ("analytics", False, []),
    ]
    item_font = get_font(script, "regular", 26)
    coll_font = get_font(script, "regular", 24)
    for db_name, expanded, collections in databases:
        y = draw_sidebar_item(draw, phone_x + 8, y, sidebar_w - 16, db_name, expanded, script)
        if expanded:
            for coll in collections:
                if y + 36 > phone_y + phone_h - 20:
                    break
                active = coll == "customers"
                color = MANGO_ORANGE if active else MANGO_GRAY
                draw.text((phone_x + 48, y), coll, font=coll_font, fill=color)
                y += 36

    # Refresh button
    refresh_font = get_font(script, "medium", 24)
    refresh_text = strings.get("Refresh", "Refresh")
    draw.text((phone_x + 24, y + 12), refresh_text, font=refresh_font, fill=MANGO_ORANGE)

    # Content area — results header
    header_font = get_font(script, "medium", 26)
    draw.text((content_x + 20, phone_y + 140), "shop_db.customers", font=header_font, fill=MANGO_ORANGE)
    doc_count = "4 " + strings.get("documents", "documents")
    draw.text((content_x + 280, phone_y + 140), doc_count, font=get_font(script, "regular", 24), fill=MANGO_GRAY)

    # Document cards
    docs = [
        ("69b26f...63b1", [("name", "Alice"), ("email", "alice@example.com"), ("age", "30"), ("role", "admin")]),
        ("69b26f...63b2", [("name", "Bob"), ("email", "bob@example.com"), ("age", "25"), ("role", "user")]),
        ("69b26f...63b3", [("name", "Charlie"), ("email", "charlie@ex.com"), ("age", "35"), ("role", "editor")]),
    ]
    cy = phone_y + 180
    for doc_id, fields in docs:
        if cy + 200 > phone_y + phone_h - 20:
            break
        cy = draw_document_card(draw, content_x + 16, cy, content_w - 32, fields, doc_id, script)


def render_query(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    """Render the query interface with filter bar and results."""
    sidebar_w = int(phone_w * 0.32)
    content_x = phone_x + sidebar_w
    content_w = phone_w - sidebar_w

    # Sidebar
    draw.rectangle([phone_x, phone_y + 80, phone_x + sidebar_w, phone_y + phone_h], fill=MANGO_SIDEBAR_BG)

    # Nav bar
    nav_items = [strings.get("Explorer", "Explorer"), "prod", strings.get("About", "About")]
    draw_nav_bar(draw, phone_x, phone_y + 90, phone_w, nav_items, 0, script)

    # Sidebar items (abbreviated)
    y = phone_y + 150
    sidebar_font = get_font(script, "bold", 30)
    draw.text((phone_x + 16, y), strings.get("Explorer", "Explorer"), font=sidebar_font, fill=MANGO_DARK)
    y += 50
    for db in ["admin", "config", "users_db"]:
        y = draw_sidebar_item(draw, phone_x + 8, y, sidebar_w - 16, db, False, script)

    # Query section
    qy = phone_y + 140
    label_font = get_font(script, "regular", 22)
    input_font = get_font(script, "regular", 28)
    btn_font = get_font(script, "bold", 28)

    # Query header
    query_title = strings.get("Query", "Query")
    draw.text((content_x + 20, qy), query_title, font=get_font(script, "bold", 30), fill=MANGO_DARK)

    # Database.Collection label
    db_coll_label = strings.get("Database . Collection", "Database . Collection")
    draw.text((content_x + 20, qy + 44), db_coll_label, font=label_font, fill=MANGO_GRAY)

    # Database input
    qy += 70
    draw.rounded_rectangle([content_x + 20, qy, content_x + content_w - 20, qy + 44], radius=4, fill=(255, 255, 255), outline=(210, 205, 198), width=2)
    draw.text((content_x + 32, qy + 8), "users_db", font=input_font, fill=MANGO_DARK)

    # Collection input
    qy += 56
    draw.rounded_rectangle([content_x + 20, qy, content_x + content_w - 20, qy + 44], radius=4, fill=(255, 255, 255), outline=(210, 205, 198), width=2)
    draw.text((content_x + 32, qy + 8), "profiles", font=input_font, fill=MANGO_DARK)

    # Filter label + input
    qy += 56
    filter_label = strings.get("Filter", "Filter")
    draw.text((content_x + 20, qy), filter_label, font=label_font, fill=MANGO_GRAY)
    qy += 28
    draw.rounded_rectangle([content_x + 20, qy, content_x + content_w - 20, qy + 44], radius=4, fill=(255, 255, 255), outline=(210, 205, 198), width=2)
    filter_text = '{ "role": "admin" }'
    draw.text((content_x + 32, qy + 8), filter_text, font=get_mono_font(24), fill=MANGO_DARK)

    # Collection indicator + Run Query button
    qy += 60
    indicator = "users_db.profiles"
    draw.text((content_x + 20, qy + 8), indicator, font=get_font(script, "medium", 24), fill=MANGO_ORANGE)
    run_text = strings.get("Run Query", "Run Query")
    rb = draw.textbbox((0, 0), run_text, font=btn_font)
    rw = rb[2] - rb[0] + 40
    rx = content_x + content_w - 20 - rw
    draw.rounded_rectangle([rx, qy, rx + rw, qy + 44], radius=8, fill=MANGO_ORANGE)
    draw.text((rx + 20, qy + 8), run_text, font=btn_font, fill=(255, 255, 255))

    # Results
    qy += 64
    result_header = "users_db.profiles   2 " + strings.get("documents", "documents")
    draw.text((content_x + 20, qy), result_header, font=get_font(script, "regular", 24), fill=MANGO_GRAY)
    qy += 36

    docs = [
        ("5f4d8a...a1b2", [("name", "Sarah Chen"), ("role", "admin"), ("active", "true")]),
        ("5f4d8a...c3d4", [("name", "James Park"), ("role", "admin"), ("active", "true")]),
    ]
    for doc_id, fields in docs:
        if qy + 180 > phone_y + phone_h - 20:
            break
        qy = draw_document_card(draw, content_x + 16, qy, content_w - 32, fields, doc_id, script)


def render_edit(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    """Render the document editing view."""
    # Full-width edit view (no sidebar)
    pad = 40

    # Nav bar
    back_text = strings.get("< Back", "< Back")
    nav_font = get_font(script, "medium", 30)
    draw.text((phone_x + pad, phone_y + 96), back_text, font=nav_font, fill=MANGO_ORANGE)

    # Title
    title = strings.get("Edit Document", "Edit Document")
    title_font = get_font(script, "bold", 36)
    draw.text((phone_x + pad, phone_y + 150), title, font=title_font, fill=MANGO_DARK)

    # JSON editor area
    editor_y = phone_y + 210
    editor_h = phone_h - 340
    draw.rounded_rectangle(
        [phone_x + pad, editor_y, phone_x + phone_w - pad, editor_y + editor_h],
        radius=12, fill=(255, 255, 255), outline=(230, 225, 218), width=2,
    )

    # JSON content (monospaced)
    mono = get_mono_font(24)
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

    jy = editor_y + 16
    # Line numbers
    for i, line in enumerate(json_lines):
        if jy + 30 > editor_y + editor_h - 16:
            break
        # Line number
        ln = str(i + 1).rjust(2)
        draw.text((phone_x + pad + 12, jy), ln, font=mono, fill=(180, 180, 180))
        # Syntax coloring
        text = line
        # Color keys in orange, strings in green, numbers/bools in blue
        draw.text((phone_x + pad + 52, jy), text, font=mono, fill=MANGO_DARK)
        jy += 32

    # Save button
    save_text = strings.get("Save Changes", "Save Changes")
    save_font = get_font(script, "bold", 32)
    sb = draw.textbbox((0, 0), save_text, font=save_font)
    sw = sb[2] - sb[0] + 60
    sx = phone_x + (phone_w - sw) // 2
    sy = editor_y + editor_h + 24
    draw.rounded_rectangle([sx, sy, sx + sw, sy + 56], radius=28, fill=MANGO_ORANGE)
    draw.text((sx + 30, sy + 12), save_text, font=save_font, fill=(255, 255, 255))


def render_native(draw, img, phone_x, phone_y, phone_w, phone_h, strings, script):
    """Render the marketing/value proposition screen."""
    cx = phone_x + phone_w // 2

    # Large Mango icon
    icon_y = phone_y + 180
    icon_r = 80
    draw.ellipse([cx - icon_r, icon_y, cx + icon_r, icon_y + icon_r * 2], fill=MANGO_ORANGE)
    draw.ellipse([cx - 10, icon_y - 14, cx + 26, icon_y + 22], fill=(100, 180, 60))

    # App name
    name_font = get_font(script, "heavy", 72)
    name = "Mango"
    nb = draw.textbbox((0, 0), name, font=name_font)
    nw = nb[2] - nb[0]
    draw.text((cx - nw // 2, icon_y + icon_r * 2 + 50), name, font=name_font, fill=MANGO_DARK)

    # Tagline
    tagline = strings.get("MongoDB, finally fast.", "MongoDB, finally fast.")
    tag_font = get_font(script, "regular", 32)
    tb = draw.textbbox((0, 0), tagline, font=tag_font)
    tw = tb[2] - tb[0]
    draw.text((cx - tw // 2, icon_y + icon_r * 2 + 140), tagline, font=tag_font, fill=MANGO_GRAY)

    # Feature list
    feature_font = get_font(script, "medium", 28)
    check_color = (76, 180, 76)
    features = [
        "macOS, iOS, Android, Linux, Windows",
        "SCRAM-SHA-256 + TLS",
        strings.get("Databases & Collections", "Databases & Collections"),
        strings.get("Query & Filter", "Query & Filter"),
        strings.get("Edit & Insert", "Edit & Insert"),
        strings.get("Index Viewer", "Index Viewer"),
    ]
    fy = icon_y + icon_r * 2 + 220
    for feat in features:
        if fy + 46 > phone_y + phone_h - 80:
            break
        # Checkmark
        draw.text((phone_x + 80, fy), "\u2713", font=feature_font, fill=check_color)
        fb = draw.textbbox((0, 0), feat, font=feature_font)
        fw = fb[2] - fb[0]
        f = feature_font
        if fw > phone_w - 160:
            shrink = int(28 * (phone_w - 160) / fw)
            f = get_font(script, "medium", shrink)
        draw.text((phone_x + 120, fy), feat, font=f, fill=MANGO_DARK)
        fy += 46

    # Bottom tagline
    bottom_font = get_font(script, "bold", 26)
    bottom = "skelpo.com"
    bb = draw.textbbox((0, 0), bottom, font=bottom_font)
    bw = bb[2] - bb[0]
    draw.text((cx - bw // 2, phone_y + phone_h - 70), bottom, font=bottom_font, fill=MANGO_GRAY)


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

def load_raw_screenshot(locale_code, config):
    """Try to load a raw simulator screenshot for this locale and scene."""
    raw_dir = os.path.join(os.path.dirname(__file__), "..", "screenshots", "raw", "ios", locale_code)
    raw_path = os.path.join(raw_dir, f"screenshot_{config['suffix']}.png")
    if os.path.exists(raw_path):
        return Image.open(raw_path)
    return None


def create_screenshot(config, screenshot_text, script, strings, locale_code=None, force_mock=False):
    """Create a single localized App Store screenshot."""
    bg_color = (18, 18, 18)
    img = Image.new("RGB", (W, H), bg_color)
    draw = ImageDraw.Draw(img)

    # ---- Caption at top ----
    caption_font = get_font(script, "heavy", 72)
    caption = screenshot_text["caption"]
    lines = caption.split("\n")
    caption_y = 180
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=caption_font)
        tw = bbox[2] - bbox[0]
        font = caption_font
        if tw > W - 100:
            shrink_size = int(72 * (W - 100) / tw)
            font = get_font(script, "heavy", shrink_size)
            bbox = draw.textbbox((0, 0), line, font=font)
            tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, caption_y), line, font=font, fill=(255, 255, 255))
        caption_y += 90

    # ---- Phone frame ----
    phone_x = 92
    phone_y = caption_y + 80
    phone_w = W - 184
    phone_h = H - phone_y - 120
    phone_r = 60

    # Try real screenshot first, fall back to mock rendering
    raw_img = None
    if not force_mock and locale_code:
        raw_img = load_raw_screenshot(locale_code, config)

    if raw_img:
        # Composite real screenshot into phone frame
        raw_img = raw_img.resize((phone_w, phone_h), Image.LANCZOS)
        # Rounded corner mask
        mask = Image.new("L", (phone_w, phone_h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, phone_w, phone_h], radius=phone_r, fill=255)
        img.paste(raw_img, (phone_x, phone_y), mask)
        # Frame border
        draw.rounded_rectangle(
            [phone_x, phone_y, phone_x + phone_w, phone_y + phone_h],
            radius=phone_r, outline=(80, 80, 80), width=3,
        )
    else:
        # Mock rendering fallback
        draw.rounded_rectangle(
            [phone_x, phone_y, phone_x + phone_w, phone_y + phone_h],
            radius=phone_r, fill=MANGO_BG, outline=(200, 195, 185), width=3,
        )
        draw_status_bar(draw, phone_x, phone_y, phone_w, script)
        scene = config["scene"]
        renderer = SCENE_RENDERERS.get(scene)
        if renderer:
            renderer(draw, img, phone_x, phone_y + 70, phone_w, phone_h - 70, strings, script)

    return img


def generate_locale(locale_code, locale_data, out_base, force_mock=False):
    """Generate all screenshots for a single locale."""
    script = locale_data["script"]
    screenshots = locale_data["screenshots"]
    strings = load_app_strings(locale_code)
    out_dir = os.path.join(out_base, locale_code)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n=== {locale_code} ({locale_data['name']}) ===")

    for config, text in zip(SCREENSHOT_CONFIGS, screenshots):
        filename = f"screenshot_{config['suffix']}.png"
        print(f"  Generating {filename}...")
        img = create_screenshot(config, text, script, strings, locale_code, force_mock)
        img.save(os.path.join(out_dir, filename), "PNG")

    print(f"  -> {len(SCREENSHOT_CONFIGS)} screenshots saved to {out_dir}/")


def main():
    parser = argparse.ArgumentParser(description="Generate localized App Store screenshots")
    parser.add_argument("locales", nargs="*", help="Locale codes to generate (default: all)")
    parser.add_argument("--list", action="store_true", help="List available locales")
    parser.add_argument("--out", default=None, help="Output base directory (default: appstore/screenshots)")
    parser.add_argument("--mock", action="store_true", help="Force mock rendering (ignore raw captures)")
    args = parser.parse_args()

    if args.list:
        for code, data in LOCALES.items():
            print(f"  {code:10s}  {data['name']}")
        return

    out_base = args.out or os.path.join(os.path.dirname(__file__), "screenshots")
    target_locales = args.locales if args.locales else list(LOCALES.keys())

    for loc in target_locales:
        if loc not in LOCALES:
            print(f"Error: unknown locale '{loc}'. Use --list to see available locales.")
            sys.exit(1)

    print(f"Generating screenshots for {len(target_locales)} locale(s)...")
    print(f"Output: {out_base}/")
    print(f"Size: {W}x{H} (iPhone 14/15 Pro Max)")

    for loc in target_locales:
        generate_locale(loc, LOCALES[loc], out_base, force_mock=args.mock)

    total = len(target_locales) * len(SCREENSHOT_CONFIGS)
    print(f"\nDone! {total} screenshots generated.")


if __name__ == "__main__":
    main()
