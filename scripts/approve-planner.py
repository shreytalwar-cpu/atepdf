#!/usr/bin/env python3
"""Owner-operated bounded API-test authorization. Makes no API calls."""
from pathlib import Path
import json
import os
import sys
import stat

root = Path(__file__).resolve().parents[1]
folder = root / '.local'
if len(sys.argv) != 2 or not sys.argv[1].isdigit() or not 1 <= int(sys.argv[1]) <= 20:
    raise SystemExit('Usage: python3 scripts/approve-planner.py REQUESTS (1–20)')
if not sys.stdin.isatty():
    raise SystemExit('Run this in an interactive terminal to approve paid test requests.')
if folder.is_symlink() or not folder.is_dir():
    raise SystemExit('Connect a key first using the masked setup.')
if (folder / 'planner.lock').exists():
    raise SystemExit('A planner request or stale lock exists. No budget was changed.')
key_path = folder / 'openai-key'
if key_path.is_symlink() or not key_path.is_file() or key_path.stat().st_mode & 0o077:
    raise SystemExit('A private local key is required.')
requests = int(sys.argv[1])
print(f'Approve at most {requests} OpenAI planning requests on this computer?')
print('Model: gpt-6-luna. Each request has a 24 KB input-body limit and no retries. atepdf sets no output-token cap.')
print('Requests are charged by OpenAI. Cancelled or failed calls still consume the local allowance. This does not set an OpenAI account spending cap.')
if input('Type APPROVE to replace the remaining allowance: ') != 'APPROVE':
    raise SystemExit('No change.')
lock = folder / 'planner.lock'
try:
    lock.mkdir(mode=0o700)
except FileExistsError:
    raise SystemExit('The planner is busy or locked. No budget was changed.')
try:
    path = folder / 'planner-settings.json'
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise SystemExit('Refusing unsafe settings.')
        os.fchmod(stream.fileno(), 0o600)
        stream.truncate(0)
        json.dump({'enabled': True, 'model': 'gpt-6-luna', 'approvedRequests': requests}, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
finally:
    lock.rmdir()
print('Local allowance saved. Requests still require confirmation inside atepdf.')
