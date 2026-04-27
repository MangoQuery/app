#!/bin/bash
# Update "What's New in This Version" for Mango on App Store Connect.
# Usage: ./update-whats-new.sh "Bug fixes and improvements"
set -euo pipefail

TEXT="${1:?Usage: ./update-whats-new.sh \"Your release notes text\"}"

BUNDLE_ID="com.skelpo.mango"
LOCALES=(en de ja zh-Hans es-MX fr pt ko it tr th id vi)

# Generate JWT and run all API calls in one python3 invocation
python3 - "$TEXT" "$BUNDLE_ID" "${LOCALES[@]}" << 'PYEOF'
import sys, json, time, struct, hashlib, hmac, urllib.request, urllib.error

text = sys.argv[1]
bundle_id = sys.argv[2]
locales_raw = sys.argv[3:]

# Map perry.toml short codes to App Store Connect locale codes
ASC_LOCALE = {
    "en": "en-US", "de": "de-DE", "fr": "fr-FR", "pt": "pt-BR",
    "it": "it", "ko": "ko", "ja": "ja", "tr": "tr", "th": "th",
    "id": "id", "vi": "vi", "zh-Hans": "zh-Hans", "es-MX": "es-MX",
}
locales = [ASC_LOCALE.get(l, l) for l in locales_raw]

# --- Credentials ---
KEY_ID = "MPJ792KV5Z"
ISSUER_ID = "69a6de6f-e591-47e3-e053-5b8c7c11a4d1"

import os
P8_PATH = os.path.expanduser(f"~/.perry/AuthKey_{KEY_ID}.p8")

# --- JWT generation (ES256) ---
import base64, subprocess

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def generate_jwt():
    header = b64url(json.dumps({"alg":"ES256","kid":KEY_ID,"typ":"JWT"}).encode())
    now = int(time.time())
    payload = b64url(json.dumps({"iss":ISSUER_ID,"iat":now,"exp":now+1200,"aud":"appstoreconnect-v1"}).encode())
    signing_input = f"{header}.{payload}".encode()

    # Sign with openssl, get DER-encoded signature
    proc = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", P8_PATH],
        input=signing_input, capture_output=True
    )
    der_sig = proc.stdout

    # Convert DER to raw R||S (64 bytes) for JWS
    # DER: 30 <total_len> 02 <r_len> <R> 02 <s_len> <S>
    assert der_sig[0] == 0x30
    idx = 1
    # skip length field (1 byte if < 128, else multi-byte)
    if der_sig[idx] & 0x80:
        idx += (der_sig[idx] & 0x7f) + 1
    else:
        idx += 1
    # R integer
    assert der_sig[idx] == 0x02; idx += 1
    r_len = der_sig[idx]; idx += 1
    r = der_sig[idx:idx+r_len]; idx += r_len
    # S integer
    assert der_sig[idx] == 0x02; idx += 1
    s_len = der_sig[idx]; idx += 1
    s = der_sig[idx:idx+s_len]
    # Pad/trim to 32 bytes each (strip leading 0x00 padding, right-justify)
    r = r[-32:].rjust(32, b'\x00')
    s = s[-32:].rjust(32, b'\x00')

    sig = b64url(r + s)
    return f"{header}.{payload}.{sig}"

token = generate_jwt()
BASE = "https://api.appstoreconnect.apple.com/v1"

def api(method, path, body=None):
    url = f"{BASE}/{path}" if not path.startswith("http") else path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        return {"error": body}, e.code

# 1. Find app
print("==> Finding app...")
data, status = api("GET", f"apps?filter[bundleId]={bundle_id}")
if "data" not in data:
    print(f"    API error (HTTP {status}): {json.dumps(data, indent=2)}", file=sys.stderr); sys.exit(1)
app_id = data["data"][0]["id"]
print(f"    App ID: {app_id}")

# 2. Find editable version
print("==> Finding editable version...")
data, _ = api("GET", f"apps/{app_id}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,READY_FOR_REVIEW&limit=1")
if not data["data"]:
    data, _ = api("GET", f"apps/{app_id}/appStoreVersions?filter[appStoreState]=WAITING_FOR_REVIEW&limit=1")
if not data["data"]:
    print("ERROR: No editable App Store version found.", file=sys.stderr); sys.exit(1)
version_id = data["data"][0]["id"]
version_str = data["data"][0]["attributes"]["versionString"]
print(f"    Version: {version_str} ({version_id})")

# 3. Get existing localizations
print("==> Getting localizations...")
data, _ = api("GET", f"appStoreVersions/{version_id}/appStoreVersionLocalizations?limit=50")
existing = {l["attributes"]["locale"]: l["id"] for l in data["data"]}

# 4. Set release notes
print(f"==> Setting release notes for {len(locales)} locales...")
ok = 0
for locale in locales:
    if locale in existing:
        loc_id = existing[locale]
        _, status = api("PATCH", f"appStoreVersionLocalizations/{loc_id}", {
            "data": {"type": "appStoreVersionLocalizations", "id": loc_id,
                     "attributes": {"whatsNew": text}}
        })
    else:
        _, status = api("POST", "appStoreVersionLocalizations", {
            "data": {"type": "appStoreVersionLocalizations",
                     "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}}},
                     "attributes": {"locale": locale, "whatsNew": text}}
        })
    if 200 <= status < 300:
        print(f"    OK {locale}")
        ok += 1
    else:
        print(f"    FAIL {locale} (HTTP {status})")

print(f"==> Done: {ok}/{len(locales)} locales updated.")
PYEOF
