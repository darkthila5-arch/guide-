#!/usr/bin/env python3
"""
FF Token Grabber
Run: python grab_token.py
Then open Free Fire on your phone and login.
Token prints automatically.
"""

import sys
import os

try:
    from mitmproxy import http
    from mitmproxy.tools.main import mitmdump
except ImportError:
    print("[!] mitmproxy not installed. Run: pip install mitmproxy")
    sys.exit(1)

# ── addon that watches requests ──────────────────────────────────────────────

ADDON_CODE = '''
import re
from mitmproxy import http

FF_HOSTS = [
    "ggblueshark.com",
    "garena.com",
    "ff.garena.com",
    "clientbp",
    "ffmobile",
    "freefire"
]

found_tokens = set()

class FFTokenGrabber:
    def request(self, flow: http.HTTPFlow):
        host = flow.request.pretty_host.lower()
        if not any(h in host for h in FF_HOSTS):
            return

        auth = flow.request.headers.get("Authorization", "")
        if auth.startswith("Bearer ") and auth not in found_tokens:
            token = auth.replace("Bearer ", "").strip()
            found_tokens.add(auth)

            print("\\n" + "="*60)
            print("  ✅  FREE FIRE TOKEN CAPTURED!")
            print("="*60)
            print(f"  Host   : {flow.request.pretty_host}")
            print(f"  URL    : {flow.request.path[:60]}")
            print("-"*60)
            print("  TOKEN (paste this into bot UI):")
            print()
            print(f"  {token}")
            print()
            print("="*60 + "\\n")

addons = [FFTokenGrabber()]
'''

ADDON_PATH = os.path.join(os.path.dirname(__file__), "_ff_addon.py")

def main():
    # write temp addon file
    with open(ADDON_PATH, "w") as f:
        f.write(ADDON_CODE)

    PORT = 8080

    print("""
╔══════════════════════════════════════════════╗
║        FF TOKEN GRABBER - AUTO MODE          ║
╠══════════════════════════════════════════════╣
║                                              ║
║  STEPS:                                      ║
║  1. Phone WiFi → Manual Proxy                ║
║     IP  : your PC IP (check ipconfig/ifconfig)║
║     Port: 8080                               ║
║                                              ║
║  2. Phone browser → http://mitm.it           ║
║     → install certificate                    ║
║                                              ║
║  3. Open Free Fire → Login                   ║
║                                              ║
║  Token will print here automatically ✅      ║
║                                              ║
║  Press Ctrl+C to stop                        ║
╚══════════════════════════════════════════════╝
""")

    sys.argv = ["mitmdump", "-p", str(PORT), "-s", ADDON_PATH, "--quiet"]
    try:
        mitmdump()
    except KeyboardInterrupt:
        print("\n[*] Stopped.")
        if os.path.exists(ADDON_PATH):
            os.remove(ADDON_PATH)

if __name__ == "__main__":
    main()
