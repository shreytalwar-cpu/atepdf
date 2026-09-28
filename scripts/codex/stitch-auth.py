#!/usr/bin/python3
"""Supply a local Stitch API key to Codex without storing it in the repository."""
import getpass
import json
import os
from pathlib import Path
import sys

KEY_FILE = Path.home() / '.codex' / 'stitch' / 'api-key'

if sys.argv[1:] == ['--setup']:
    if not sys.stdin.isatty():
        sys.exit('Run this command in your own terminal to enter the key privately.')
    if KEY_FILE.exists():
        sys.exit('A Stitch key is already saved; no changes made.')
    key = getpass.getpass('Paste your Stitch API key (input is hidden): ').strip()
    if not key or any(c.isspace() for c in key):
        sys.exit('Expected a non-empty API key without whitespace; nothing saved.')
    KEY_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(key)
    print('Stitch key saved privately outside the repository. Return to Codex to verify the connection.')
elif sys.argv[1:]:
    sys.exit('Usage: stitch-auth.py [--setup]')
else:
    key = KEY_FILE.read_text().strip() if KEY_FILE.exists() else ''
    print(json.dumps({'X-Goog-Api-Key': key} if key else {}))
