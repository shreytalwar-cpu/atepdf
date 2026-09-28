#!/usr/bin/env python3
"""Read-only destination guard for the handoff, NOT an OS sandbox or code audit.

Never creates, edits, installs, builds or runs git. Resolve symlinks and reject
common new/legacy path mistakes before the real Codex setup. No private paths
are printed. Review source identity and Git history separately.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

class BoundaryError(ValueError):
    """An unsafe or ambiguous destination needs owner review, not cleanup."""

def _resolve(value: str | Path) -> Path:
    if not str(value).strip():
        raise BoundaryError('EMPTY_PATH')
    p = Path(value).expanduser()
    if not p.is_absolute():
        raise BoundaryError('ABSOLUTE_PATH_REQUIRED')
    try:
        return p.resolve(strict=False)
    except (OSError, RuntimeError) as exc:
        raise BoundaryError('PATH_RESOLUTION_FAILED') from exc

def assess_roots(new_root: str | Path, legacy_root: str | Path | None = None) -> dict:
    new = _resolve(new_root)
    old = _resolve(legacy_root) if legacy_root is not None else None
    if new == Path(new.anchor):
        raise BoundaryError('FILESYSTEM_ROOT_NOT_A_PROJECT')
    if new.exists() and not new.is_dir():
        raise BoundaryError('NEW_ROOT_NOT_DIRECTORY')
    if old is not None:
        if new == old:
            raise BoundaryError('SAME_ROOT')
        if new.is_relative_to(old):
            raise BoundaryError('NEW_INSIDE_LEGACY')
        if old.is_relative_to(new):
            raise BoundaryError('NEW_CONTAINS_LEGACY')
        if old.exists() and not old.is_dir():
            raise BoundaryError('LEGACY_ROOT_NOT_DIRECTORY')
    # A parent checkout would make git init in new create nested history.
    for parent in new.parents:
        if (parent / '.git').exists():
            raise BoundaryError('PARENT_GIT_REPOSITORY')
    git_marker = new / '.git'
    if git_marker.is_file() or git_marker.is_symlink():
        raise BoundaryError('LINKED_GIT_ROOT_REQUIRES_REVIEW')
    legacy_status = ('not_supplied' if old is None else
                     'path_exists_not_source_audited' if old.exists() else
                     'path_unavailable_learning_pending')
    if not new.exists():
        state = 'new_directory_not_yet_created'
    else:
        marker = new / '.atepdf-project.json'
        entries = {p.name for p in new.iterdir()}
        if marker.exists():
            try:
                m = json.loads(marker.read_text(encoding='utf-8'))
            except (OSError, ValueError) as exc:
                raise BoundaryError('INVALID_PROJECT_MARKER') from exc
            if not isinstance(m, dict) or m.get('product') != 'atepdf' or m.get('build_origin') != 'fresh_repository':
                raise BoundaryError('WRONG_PROJECT_MARKER')
            if m.get('status') != 'initialized':
                raise BoundaryError('TEMPLATE_MARKER_NOT_INITIALIZED')
            state = 'resume_new_atepdf_after_source_identity_review'
        elif entries <= {'handoff', '.git', '.DS_Store'}:
            state = 'new_destination_ready_for_setup'
        else:
            raise BoundaryError('NONEMPTY_UNVERIFIED_DESTINATION')
    return {
        'boundary_check_passed': True,
        'destination_state': state,
        'legacy_reference_status': legacy_status,
        'legacy_writes_allowed': False,
        'new_scaffold_blocked_by_missing_legacy': False,
        'filesystem_mutations_performed': False,
        'os_read_only_permission_verified': False,
        'git_history_or_cloning_audited': False,
        'code_or_legacy_runtime_audited': False,
        'note': 'Passing this guard is not permission enforcement, source identity proof, or a runnable app.'
    }

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--new-root', required=True)
    parser.add_argument('--legacy-root')
    args = parser.parse_args()
    try:
        result = assess_roots(args.new_root, args.legacy_root)
    except (BoundaryError, OSError) as exc:
        code = str(exc) if isinstance(exc, BoundaryError) else 'FILESYSTEM_READ_FAILED'
        print(json.dumps({'boundary_check_passed': False, 'code': code, 'action': 'Review paths; never delete or reset user work.'}))
        return 2
    print(json.dumps(result, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
