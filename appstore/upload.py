#!/usr/bin/env python3
"""Upload localized metadata and screenshots to App Store Connect.

Usage:
    python appstore/upload.py metadata                  # upload metadata for all locales
    python appstore/upload.py screenshots               # upload screenshots for all locales
    python appstore/upload.py all                       # upload both
    python appstore/upload.py metadata --locale de-DE   # specific locale only
    python appstore/upload.py --dry-run all             # preview without uploading

Requirements: pip install PyJWT cryptography requests

Setup:
    1. Create an API key in App Store Connect → Users and Access → Integrations → API Keys
    2. Copy appstore/config.example.json to appstore/config.json
    3. Fill in issuer_id, key_id, and path to your .p8 key file
"""

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

try:
    import jwt
    import requests
except ImportError:
    print("Missing dependencies. Install with: pip install PyJWT cryptography requests")
    sys.exit(1)

from locales import LOCALES

BASE_URL = "https://api.appstoreconnect.apple.com/v1"

# Screenshot display types
IPHONE_DISPLAY_TYPE = "APP_IPHONE_65"  # 6.5" = 1284x2778 (iPhone 14/15 Pro Max)
MAC_DISPLAY_TYPE = "APP_DESKTOP"       # macOS desktop


# ---------------------------------------------------------------------------
# App Store Connect API client
# ---------------------------------------------------------------------------

class AppStoreConnectAPI:
    def __init__(self, issuer_id, key_id, key_file):
        self.issuer_id = issuer_id
        self.key_id = key_id
        with open(key_file) as f:
            self.private_key = f.read()
        self._token = None
        self._token_exp = 0

    @property
    def token(self):
        now = int(time.time())
        if self._token and now < self._token_exp - 60:
            return self._token
        exp = now + 20 * 60  # 20 min
        payload = {
            "iss": self.issuer_id,
            "exp": exp,
            "aud": "appstoreconnect-v1",
        }
        self._token = jwt.encode(
            payload, self.private_key, algorithm="ES256",
            headers={"kid": self.key_id},
        )
        self._token_exp = exp
        return self._token

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _request(self, method, path, **kwargs):
        url = f"{BASE_URL}{path}" if path.startswith("/") else path
        for attempt in range(3):
            r = requests.request(method, url, headers=self._headers(), **kwargs)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 5))
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            if r.status_code >= 400:
                print(f"  API error {r.status_code}: {r.text[:500]}")
            r.raise_for_status()
            return r
        raise Exception("Max retries exceeded")

    def get(self, path, params=None):
        return self._request("GET", path, params=params).json()

    def post(self, path, data):
        return self._request("POST", path, json=data).json()

    def patch(self, path, data):
        return self._request("PATCH", path, json=data).json()

    def delete(self, path):
        self._request("DELETE", path)

    # -- High-level helpers --

    def get_app(self, bundle_id):
        data = self.get("/apps", params={"filter[bundleId]": bundle_id})
        apps = data["data"]
        exact = [a for a in apps if a["attributes"]["bundleId"] == bundle_id]
        if not exact:
            raise ValueError(f"No app found with bundle ID: {bundle_id}")
        if len(exact) > 1:
            names = [a["attributes"]["name"] for a in exact]
            raise ValueError(f"Multiple apps with bundle ID {bundle_id}: {names}")
        return exact[0]

    def get_edit_version(self, app_id, platform="IOS"):
        for state in ["PREPARE_FOR_SUBMISSION", "REJECTED", "DEVELOPER_REJECTED",
                       "DEVELOPER_ACTION_NEEDED", "INVALID_BINARY", "READY_FOR_SALE"]:
            data = self.get(
                f"/apps/{app_id}/appStoreVersions",
                params={
                    "filter[appStoreState]": state,
                    "filter[platform]": platform,
                },
            )
            if data["data"]:
                return data["data"][0]
        raise ValueError(
            f"No editable App Store version found for platform {platform}. "
            "Create a new version in App Store Connect first."
        )

    def get_version_localizations(self, version_id):
        data = self.get(f"/appStoreVersions/{version_id}/appStoreVersionLocalizations")
        return {loc["attributes"]["locale"]: loc for loc in data["data"]}

    def get_app_info(self, app_id):
        data = self.get(f"/apps/{app_id}/appInfos")
        if not data["data"]:
            return None
        for info in data["data"]:
            state = info["attributes"].get("appStoreState", "")
            if state != "READY_FOR_SALE":
                return info
        return data["data"][0]

    def get_app_info_localizations(self, app_info_id):
        data = self.get(f"/appInfos/{app_info_id}/appInfoLocalizations")
        return {loc["attributes"]["locale"]: loc for loc in data["data"]}


# ---------------------------------------------------------------------------
# Metadata upload
# ---------------------------------------------------------------------------

def upload_metadata(api, version_id, app_info_id, locale_code, locale_data,
                    dry_run=False, version_state=None):
    print(f"\n--- {locale_code}: {locale_data['name']} ---")

    version_locs = api.get_version_localizations(version_id)
    version_attrs = {
        "description": locale_data["description"],
        "keywords": locale_data["keywords"],
        "promotionalText": locale_data["promotional_text"],
        "marketingUrl": "https://mangoquery.com",
        "supportUrl": "https://mangoquery.com",
    }
    if version_state != "READY_FOR_SALE":
        version_attrs["whatsNew"] = locale_data.get("whats_new", "")

    if locale_code in version_locs:
        loc_id = version_locs[locale_code]["id"]
        print(f"  Updating version localization {loc_id}...")
        if not dry_run:
            try:
                api.patch(f"/appStoreVersionLocalizations/{loc_id}", {
                    "data": {
                        "type": "appStoreVersionLocalizations",
                        "id": loc_id,
                        "attributes": version_attrs,
                    }
                })
            except Exception:
                version_attrs.pop("whatsNew", None)
                print(f"  Retrying without whatsNew...")
                api.patch(f"/appStoreVersionLocalizations/{loc_id}", {
                    "data": {
                        "type": "appStoreVersionLocalizations",
                        "id": loc_id,
                        "attributes": version_attrs,
                    }
                })
    else:
        print(f"  Creating version localization...")
        if not dry_run:
            api.post("/appStoreVersionLocalizations", {
                "data": {
                    "type": "appStoreVersionLocalizations",
                    "attributes": {"locale": locale_code, **version_attrs},
                    "relationships": {
                        "appStoreVersion": {
                            "data": {"type": "appStoreVersions", "id": version_id}
                        }
                    },
                }
            })

    if app_info_id:
        info_locs = api.get_app_info_localizations(app_info_id)
        info_attrs = {
            "name": locale_data["name"],
            "subtitle": locale_data["subtitle"],
        }

        if locale_code in info_locs:
            info_loc_id = info_locs[locale_code]["id"]
            print(f"  Updating app info localization {info_loc_id}...")
            if not dry_run:
                api.patch(f"/appInfoLocalizations/{info_loc_id}", {
                    "data": {
                        "type": "appInfoLocalizations",
                        "id": info_loc_id,
                        "attributes": info_attrs,
                    }
                })
        else:
            print(f"  Creating app info localization...")
            if not dry_run:
                api.post("/appInfoLocalizations", {
                    "data": {
                        "type": "appInfoLocalizations",
                        "attributes": {"locale": locale_code, **info_attrs},
                        "relationships": {
                            "appInfo": {
                                "data": {"type": "appInfos", "id": app_info_id}
                            }
                        },
                    }
                })

    print(f"  Done.")


# ---------------------------------------------------------------------------
# Screenshot upload
# ---------------------------------------------------------------------------

def upload_screenshots(api, version_id, locale_code, screenshot_dir, dry_run=False,
                       display_type=None, file_prefix="screenshot_"):
    if display_type is None:
        display_type = IPHONE_DISPLAY_TYPE
    locale_dir = os.path.join(screenshot_dir, locale_code)
    if not os.path.isdir(locale_dir):
        print(f"  No screenshots directory: {locale_dir} — skipping")
        return

    png_files = sorted(
        f for f in os.listdir(locale_dir)
        if f.startswith(file_prefix) and f.endswith(".png")
    )
    if not png_files:
        print(f"  No {file_prefix}*.png files in {locale_dir} — skipping")
        return

    print(f"\n--- {locale_code}: uploading {len(png_files)} screenshots ---")

    version_locs = api.get_version_localizations(version_id)
    if locale_code not in version_locs:
        print(f"  Creating version localization for {locale_code}...")
        if dry_run:
            print(f"  [dry-run] Would create localization and upload {len(png_files)} screenshots")
            return
        result = api.post("/appStoreVersionLocalizations", {
            "data": {
                "type": "appStoreVersionLocalizations",
                "attributes": {"locale": locale_code},
                "relationships": {
                    "appStoreVersion": {
                        "data": {"type": "appStoreVersions", "id": version_id}
                    }
                },
            }
        })
        loc_id = result["data"]["id"]
    else:
        loc_id = version_locs[locale_code]["id"]

    sets_data = api.get(f"/appStoreVersionLocalizations/{loc_id}/appScreenshotSets")
    screenshot_sets = {s["attributes"]["screenshotDisplayType"]: s for s in sets_data["data"]}

    if display_type in screenshot_sets:
        set_id = screenshot_sets[display_type]["id"]
        existing = api.get(f"/appScreenshotSets/{set_id}/appScreenshots")
        for ss in existing["data"]:
            print(f"  Deleting old screenshot {ss['id']}...")
            if not dry_run:
                api.delete(f"/appScreenshots/{ss['id']}")
    else:
        print(f"  Creating screenshot set ({display_type})...")
        if dry_run:
            print(f"  [dry-run] Would create set and upload {len(png_files)} screenshots")
            return
        result = api.post("/appScreenshotSets", {
            "data": {
                "type": "appScreenshotSets",
                "attributes": {"screenshotDisplayType": display_type},
                "relationships": {
                    "appStoreVersionLocalization": {
                        "data": {"type": "appStoreVersionLocalizations", "id": loc_id}
                    }
                },
            }
        })
        set_id = result["data"]["id"]

    if dry_run:
        for f in png_files:
            print(f"  [dry-run] Would upload {f}")
        return

    for filename in png_files:
        filepath = os.path.join(locale_dir, filename)
        file_size = os.path.getsize(filepath)
        print(f"  Uploading {filename} ({file_size // 1024}KB)...")

        reservation = api.post("/appScreenshots", {
            "data": {
                "type": "appScreenshots",
                "attributes": {
                    "fileName": filename,
                    "fileSize": file_size,
                },
                "relationships": {
                    "appScreenshotSet": {
                        "data": {"type": "appScreenshotSets", "id": set_id}
                    }
                },
            }
        })

        screenshot_id = reservation["data"]["id"]
        upload_ops = reservation["data"]["attributes"]["uploadOperations"]

        with open(filepath, "rb") as f:
            file_data = f.read()

        for op in upload_ops:
            headers = {h["name"]: h["value"] for h in op["requestHeaders"]}
            chunk = file_data[op["offset"]:op["offset"] + op["length"]]
            r = requests.put(op["url"], headers=headers, data=chunk)
            r.raise_for_status()

        checksum = hashlib.md5(file_data).hexdigest()
        api.patch(f"/appScreenshots/{screenshot_id}", {
            "data": {
                "type": "appScreenshots",
                "id": screenshot_id,
                "attributes": {
                    "uploaded": True,
                    "sourceFileChecksum": checksum,
                },
            }
        })

        print(f"    Uploaded successfully.")

    print(f"  {len(png_files)} screenshots uploaded for {locale_code}.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def load_config():
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if not os.path.exists(config_path):
        print(f"Config file not found: {config_path}")
        print(f"Copy config.example.json to config.json and fill in your API credentials.")
        sys.exit(1)
    with open(config_path) as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description="Upload localized App Store metadata and screenshots",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python appstore/upload.py metadata                 # all locales
  python appstore/upload.py screenshots --locale ja  # Japanese screenshots only
  python appstore/upload.py all --dry-run            # preview all changes
        """,
    )
    parser.add_argument(
        "action", choices=["metadata", "screenshots", "all"],
        help="What to upload",
    )
    parser.add_argument(
        "--locale", action="append", dest="locales",
        help="Specific locale(s) to upload (can repeat). Default: all.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview changes without uploading",
    )
    parser.add_argument(
        "--screenshots-dir", default=None,
        help="Screenshots directory (default: appstore/screenshots/)",
    )
    parser.add_argument(
        "--mac", action="store_true",
        help="Upload Mac (APP_DESKTOP) screenshots instead of iPhone. "
             "Looks for mac_screenshot_*.png files.",
    )
    args = parser.parse_args()

    config = load_config()
    target_locales = args.locales if args.locales else list(LOCALES.keys())
    screenshots_dir = args.screenshots_dir or os.path.join(os.path.dirname(__file__), "screenshots")

    for loc in target_locales:
        if loc not in LOCALES:
            print(f"Error: unknown locale '{loc}'. Available: {', '.join(LOCALES.keys())}")
            sys.exit(1)

    if args.dry_run:
        print("=== DRY RUN (no changes will be made) ===\n")

    print("Connecting to App Store Connect...")
    api = AppStoreConnectAPI(config["issuer_id"], config["key_id"], config["key_file"])

    bundle_id = config.get("bundle_id", "com.skelpo.mango")
    print(f"Looking up app: {bundle_id}")
    app = api.get_app(bundle_id)
    app_id = app["id"]
    print(f"App ID: {app_id}")

    platform = "MAC_OS" if args.mac else "IOS"
    version = api.get_edit_version(app_id, platform=platform)
    version_id = version["id"]
    version_string = version["attributes"]["versionString"]
    version_state = version["attributes"].get("appStoreState", "")
    print(f"Version: {version_string} (ID: {version_id}, platform: {platform}, state: {version_state})")

    app_info = api.get_app_info(app_id)
    app_info_id = app_info["id"] if app_info else None

    print(f"\nTarget locales: {', '.join(target_locales)}")
    print(f"Action: {args.action}")

    if args.action in ("metadata", "all"):
        print("\n========== METADATA ==========")
        for loc in target_locales:
            upload_metadata(api, version_id, app_info_id, loc, LOCALES[loc],
                            dry_run=args.dry_run, version_state=version_state)

    if args.action in ("screenshots", "all"):
        display_type = MAC_DISPLAY_TYPE if args.mac else IPHONE_DISPLAY_TYPE
        file_prefix = "mac_screenshot_" if args.mac else "screenshot_"
        print(f"\n========== SCREENSHOTS ({display_type}) ==========")
        for loc in target_locales:
            upload_screenshots(api, version_id, loc, screenshots_dir,
                               dry_run=args.dry_run, display_type=display_type,
                               file_prefix=file_prefix)

    print("\n=== Complete! ===")
    if args.dry_run:
        print("(This was a dry run. Remove --dry-run to apply changes.)")


if __name__ == "__main__":
    main()
