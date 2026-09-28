#!/usr/bin/env python3
"""Owner-operated, masked local credential entry. Never prints the key or calls an API."""
from pathlib import Path
import getpass
import json
import os
import sys
import warnings


def main():
    root = Path(__file__).resolve().parents[1]
    folder = root / '.local'
    if folder.is_symlink():
        raise SystemExit('Refusing a linked local configuration directory.')
    folder.mkdir(mode=0o700, exist_ok=True)
    os.chmod(folder, 0o700)
    key_path = folder / 'openai-key'
    if key_path.exists() or key_path.is_symlink():
        raise SystemExit('A local key already exists. It has not been changed.')
    if not sys.stdin.isatty():
        raise SystemExit('Run this in an interactive terminal so key entry stays hidden.')
    print('Connect OpenAI to atepdf on this computer. No key enters chat or Git.')
    print('This step makes no API calls and leaves paid planning disabled.')
    warnings.simplefilter('error', getpass.GetPassWarning)
    key = getpass.getpass('OpenAI project key (hidden): ').strip()
    if not key.startswith('sk-') or len(key) < 20 or any(c.isspace() for c in key):
        raise SystemExit('That does not look like an OpenAI API key. Nothing was saved.')
    fd = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(key)
    settings = folder / 'planner-settings.json'
    if not settings.exists():
        fd = os.open(settings, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump({'enabled': False, 'model': 'gpt-5.6-luna', 'approvedRequests': 0}, stream, indent=2)
    print('Key saved privately. Planning remains disabled until a bounded test run is approved.')


if __name__ == '__main__':
    main()
