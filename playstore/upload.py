#!/usr/bin/env python3
"""Upload localized metadata and screenshots to Google Play Console.

Usage:
    python playstore/upload.py metadata                  # upload metadata for all locales
    python playstore/upload.py screenshots               # upload screenshots for all locales
    python playstore/upload.py all                       # upload both
    python playstore/upload.py metadata --locale de-DE   # specific locale only
    python playstore/upload.py --dry-run all             # preview without uploading

Requirements: pip install google-api-python-client google-auth

Setup:
    1. Ensure your Google Cloud service account has Google Play Android Developer API access
    2. Copy playstore/config.example.json to playstore/config.json
    3. Fill in the path to your service account key and your package name
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
except ImportError:
    print("Missing dependencies. Install with: pip install google-api-python-client google-auth")
    sys.exit(1)

# Add appstore/ to path so we can import locales
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "appstore"))
from locales import LOCALES

# ---------------------------------------------------------------------------
# Locale mapping: App Store Connect locale → Google Play locale
# ---------------------------------------------------------------------------

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

PHONE_IMAGE_TYPE = "phoneScreenshots"


# ---------------------------------------------------------------------------
# Google Play API client
# ---------------------------------------------------------------------------

class GooglePlayAPI:
    def __init__(self, service_account_key, package_name):
        self.package_name = package_name
        credentials = service_account.Credentials.from_service_account_file(
            service_account_key,
            scopes=["https://www.googleapis.com/auth/androidpublisher"],
        )
        self.service = build("androidpublisher", "v3", credentials=credentials)
        self._edit_id = None

    def open_edit(self):
        result = self.service.edits().insert(
            packageName=self.package_name, body={}
        ).execute()
        self._edit_id = result["id"]
        print(f"Opened edit: {self._edit_id}")
        return self._edit_id

    def commit_edit(self):
        self.service.edits().commit(
            packageName=self.package_name, editId=self._edit_id
        ).execute()
        print(f"Committed edit: {self._edit_id}")
        self._edit_id = None

    def delete_edit(self):
        if self._edit_id:
            try:
                self.service.edits().delete(
                    packageName=self.package_name, editId=self._edit_id
                ).execute()
            except Exception:
                pass
            self._edit_id = None

    def get_listing(self, locale):
        try:
            return self.service.edits().listings().get(
                packageName=self.package_name,
                editId=self._edit_id,
                language=locale,
            ).execute()
        except Exception:
            return None

    def update_listing(self, locale, title, short_desc, full_desc):
        body = {
            "language": locale,
            "title": title,
            "shortDescription": short_desc,
            "fullDescription": full_desc,
        }
        return self.service.edits().listings().update(
            packageName=self.package_name,
            editId=self._edit_id,
            language=locale,
            body=body,
        ).execute()

    def list_images(self, locale, image_type):
        try:
            result = self.service.edits().images().list(
                packageName=self.package_name,
                editId=self._edit_id,
                language=locale,
                imageType=image_type,
            ).execute()
            return result.get("images", [])
        except Exception:
            return []

    def delete_all_images(self, locale, image_type):
        self.service.edits().images().deleteall(
            packageName=self.package_name,
            editId=self._edit_id,
            language=locale,
            imageType=image_type,
        ).execute()

    def upload_image(self, locale, image_type, image_path):
        media = MediaFileUpload(image_path, mimetype="image/png")
        return self.service.edits().images().upload(
            packageName=self.package_name,
            editId=self._edit_id,
            language=locale,
            imageType=image_type,
            media_body=media,
        ).execute()


# ---------------------------------------------------------------------------
# Metadata upload
# ---------------------------------------------------------------------------

def make_short_description(locale_data):
    text = locale_data["promotional_text"]
    if len(text) <= 80:
        return text
    for sep in [". ", "。", "！", "! "]:
        idx = text[:78].rfind(sep)
        if idx > 30:
            return text[:idx + len(sep)].rstrip()
    truncated = text[:77].rsplit(" ", 1)[0]
    return truncated + "…"


def make_title(locale_data):
    name = locale_data["name"]
    if len(name) <= 30:
        return name
    if " — " in name:
        short = name.split(" — ")[0]
        if len(short) <= 30:
            return short
    return name[:30]


def upload_metadata(api, appstore_locale, play_locale, locale_data, dry_run=False):
    title = make_title(locale_data)
    short_desc = make_short_description(locale_data)
    full_desc = locale_data["description"]

    print(f"\n--- {play_locale} ({locale_data['name']}) ---")
    print(f"  Title ({len(title)}/30): {title}")
    print(f"  Short desc ({len(short_desc)}/80): {short_desc[:60]}...")
    print(f"  Full desc: {len(full_desc)} chars")

    if len(title) > 30:
        print(f"  WARNING: title exceeds 30 chars!")
    if len(short_desc) > 80:
        print(f"  WARNING: short description exceeds 80 chars!")
    if len(full_desc) > 4000:
        print(f"  WARNING: full description exceeds 4000 chars!")

    if dry_run:
        print(f"  [dry-run] Would update listing")
        return

    api.update_listing(play_locale, title, short_desc, full_desc)
    print(f"  Updated.")


# ---------------------------------------------------------------------------
# Screenshot upload
# ---------------------------------------------------------------------------

def upload_screenshots(api, play_locale, screenshot_dir, dry_run=False):
    locale_dir = os.path.join(screenshot_dir, play_locale)
    if not os.path.isdir(locale_dir):
        print(f"  No screenshots directory: {locale_dir} — skipping")
        return

    png_files = sorted(
        f for f in os.listdir(locale_dir)
        if f.startswith("screenshot_") and f.endswith(".png")
    )
    if not png_files:
        print(f"  No screenshot_*.png files in {locale_dir} — skipping")
        return

    print(f"\n--- {play_locale}: uploading {len(png_files)} screenshots ---")

    if dry_run:
        for f in png_files:
            print(f"  [dry-run] Would upload {f}")
        return

    existing = api.list_images(play_locale, PHONE_IMAGE_TYPE)
    if existing:
        print(f"  Deleting {len(existing)} existing screenshots...")
        api.delete_all_images(play_locale, PHONE_IMAGE_TYPE)

    for filename in png_files:
        filepath = os.path.join(locale_dir, filename)
        file_size = os.path.getsize(filepath)
        print(f"  Uploading {filename} ({file_size // 1024}KB)...")
        api.upload_image(play_locale, PHONE_IMAGE_TYPE, filepath)

    print(f"  {len(png_files)} screenshots uploaded.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def load_config():
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if not os.path.exists(config_path):
        print(f"Config file not found: {config_path}")
        print(f"Copy config.example.json to config.json and fill in your settings.")
        sys.exit(1)
    with open(config_path) as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description="Upload localized Google Play Store metadata and screenshots",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python playstore/upload.py metadata                 # all locales
  python playstore/upload.py screenshots --locale ja  # Japanese screenshots only
  python playstore/upload.py all --dry-run            # preview all changes
        """,
    )
    parser.add_argument(
        "action", choices=["metadata", "screenshots", "all"],
        help="What to upload",
    )
    parser.add_argument(
        "--locale", action="append", dest="locales",
        help="Specific App Store locale(s) to upload (can repeat). Default: all.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview changes without uploading",
    )
    parser.add_argument(
        "--screenshots-dir", default=None,
        help="Screenshots directory (default: playstore/screenshots/)",
    )
    args = parser.parse_args()

    config = load_config()
    screenshots_dir = args.screenshots_dir or os.path.join(os.path.dirname(__file__), "screenshots")

    all_locales = list(LOCALES.keys())
    target_locales = args.locales if args.locales else all_locales

    for loc in target_locales:
        if loc not in LOCALES:
            print(f"Error: unknown locale '{loc}'. Available: {', '.join(all_locales)}")
            sys.exit(1)
        if loc not in PLAY_LOCALE_MAP:
            print(f"Error: no Google Play mapping for locale '{loc}'.")
            sys.exit(1)

    if args.dry_run:
        print("=== DRY RUN (no changes will be made) ===\n")

    print("Connecting to Google Play Developer API...")
    api = GooglePlayAPI(config["service_account_key"], config["package_name"])

    print(f"Package: {config['package_name']}")
    print(f"Target locales: {', '.join(PLAY_LOCALE_MAP[l] for l in target_locales)}")
    print(f"Action: {args.action}")

    if not args.dry_run:
        api.open_edit()

    try:
        if args.action in ("metadata", "all"):
            print("\n========== METADATA ==========")
            for loc in target_locales:
                play_locale = PLAY_LOCALE_MAP[loc]
                upload_metadata(api, loc, play_locale, LOCALES[loc], dry_run=args.dry_run)

        if args.action in ("screenshots", "all"):
            print("\n========== SCREENSHOTS ==========")
            for loc in target_locales:
                play_locale = PLAY_LOCALE_MAP[loc]
                upload_screenshots(api, play_locale, screenshots_dir, dry_run=args.dry_run)

        if not args.dry_run:
            api.commit_edit()

    except Exception as e:
        print(f"\nError: {e}")
        if not args.dry_run:
            print("Discarding edit...")
            api.delete_edit()
        raise

    print("\n=== Complete! ===")
    if args.dry_run:
        print("(This was a dry run. Remove --dry-run to apply changes.)")


if __name__ == "__main__":
    main()
