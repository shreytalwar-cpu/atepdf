"""Local launch-review checklist model. It does not execute or authorise anything.

Callers must authenticate approval and verify evidence outside agent-editable files.
No provider integration, account access, atomic budget reservation or scheduler exists
in this reference. Passing it is not production permission.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Mapping
import re

REQUIRED_CHECKS = frozenset({
    'product_workflow','target_platforms','in_app_browser','claims','creative_rights',
    'price_terms','consent','purchase_restore_refund','event_reconciliation',
    'privacy_network','export_follow_up','support_route','gross_budget',
    'account_identity','rollback',
})
SPEC_FIELDS = frozenset({
    'campaign_id','account_alias','currency','gross_cash_minor','asset_sha256',
    'landing_version','price_version','starts_at','ends_at',
})
APPROVAL_FIELDS = frozenset({
    'schema_version','status','approved','account_alias','campaign_id','currency',
    'cash_cap_minor','starts_at','expires_at','asset_sha256','landing_version',
    'price_version','approval_evidence_ref',
})


def _integer(value: Any, name: str) -> int:
    if type(value) is not int or value < 0:
        raise ValueError(f'{name}: nonnegative integer minor units required')
    return value


def _time(value: Any, name: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f'{name}: ISO date/time required')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError(f'{name}: invalid date/time') from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f'{name}: explicit timezone required')
    return parsed.astimezone(timezone.utc)


def _nonempty(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{name}: nonempty string required')
    return value


def evaluate_launch(
    spec: Mapping[str, Any], checks: Mapping[str, bool],
    approval: Mapping[str, Any] | None, *, now: datetime,
    trusted_approval: bool = False, evidence_verified: bool = False,
    already_spent_minor: int = 0, reserved_minor: int = 0,
) -> dict[str, Any]:
    """Return checklist findings only. Never changes a provider or starts delivery."""
    if not isinstance(spec, Mapping) or set(spec) != SPEC_FIELDS:
        raise ValueError('spec: exact allowlisted fields required')
    if not isinstance(checks, Mapping) or set(checks) != REQUIRED_CHECKS:
        raise ValueError('checks: complete exact checklist required')
    if any(type(v) is not bool for v in checks.values()):
        raise ValueError('checks: boolean values required')
    if type(trusted_approval) is not bool or type(evidence_verified) is not bool:
        raise ValueError('trust/evidence arguments must be boolean')
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError('now: timezone-aware datetime required')
    now = now.astimezone(timezone.utc)
    for name in ('campaign_id','account_alias','landing_version','price_version'):
        _nonempty(spec[name], name)
    if not isinstance(spec['currency'], str) or not re.fullmatch(r'[A-Z]{3}', spec['currency']):
        raise ValueError('currency: three-letter uppercase code required')
    if not isinstance(spec['asset_sha256'], str) or not re.fullmatch(r'[0-9a-f]{64}', spec['asset_sha256']):
        raise ValueError('asset_sha256: lowercase SHA-256 required')
    gross = _integer(spec['gross_cash_minor'], 'gross_cash_minor')
    spent = _integer(already_spent_minor, 'already_spent_minor')
    reserved = _integer(reserved_minor, 'reserved_minor')
    start = _time(spec['starts_at'], 'starts_at')
    end = _time(spec['ends_at'], 'ends_at')
    if end <= start:
        raise ValueError('spec: end must follow start')

    findings = [f'check_not_passed:{key}' for key in sorted(checks) if not checks[key]]
    if not evidence_verified:
        findings.append('application_evidence_not_verified')
    if gross == 0:
        findings.append('zero_requested_budget')
    if end <= now:
        findings.append('campaign_window_expired')
    if approval is None:
        findings.append('no_approval')
    else:
        if not isinstance(approval, Mapping) or not APPROVAL_FIELDS <= set(approval) or set(approval) - APPROVAL_FIELDS - {'note'}:
            raise ValueError('approval: exact approved fields required')
        if type(approval['approved']) is not bool:
            raise ValueError('approval approved flag must be boolean')
        if approval['schema_version'] != 1 or type(approval['schema_version']) is not int:
            raise ValueError('approval: unsupported schema')
        if not trusted_approval:
            findings.append('approval_not_authenticated_by_caller')
        if approval['approved'] is not True or approval['status'] != 'approved':
            findings.append('approval_is_draft_or_revoked')
        if not approval['approval_evidence_ref']:
            findings.append('missing_approval_evidence')
        for key in ('account_alias','campaign_id','currency','asset_sha256','landing_version','price_version'):
            if approval[key] != spec[key]:
                findings.append(f'approval_mismatch:{key}')
        cap = _integer(approval['cash_cap_minor'], 'cash_cap_minor')
        if cap == 0 or gross + spent + reserved > cap:
            findings.append('gross_cash_cap_exceeded')
        if approval['starts_at'] is None or approval['expires_at'] is None:
            findings.append('approval_window_missing')
        else:
            approve_start = _time(approval['starts_at'], 'approval.starts_at')
            approve_end = _time(approval['expires_at'], 'approval.expires_at')
            if approve_end <= approve_start:
                raise ValueError('approval: invalid date window')
            if now < approve_start or now >= approve_end:
                findings.append('approval_not_current')
            if start < approve_start or end > approve_end:
                findings.append('campaign_outside_approval_window')

    return {
        'status': 'blocked' if findings else 'reference_checks_ready',
        'findings': findings,
        'reference_only': True,
        'provider_action_executed': False,
        'note': 'Not authorisation. Verify actual approval, provider controls, rights and atomic reservations before any action.',
    }
