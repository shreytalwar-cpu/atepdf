"""Pure reference policy. NOT production authorization or a payment integration.
The app/backend must derive entitlement state from verified provider data, not client input.
"""
from dataclasses import dataclass, fields
from typing import Mapping, Any

ACTIONS = frozenset({"local_quick_action", "new_cloud_job", "replay_recipe", "save_recipe", "view_output", "export_output"})
STATES = frozenset({"free", "active", "cancelled_active", "grace_active", "pending", "verifying", "expired", "revoked"})
PAID = frozenset({"active", "cancelled_active", "grace_active"})

@dataclass(frozen=True)
class Context:
    action: str = "new_cloud_job"
    entitlement: str = "free"
    capability_ready: bool = True
    files_ready: bool = True
    ai_consent: bool = True
    network_available: bool = True
    entitlement_known: bool = True
    jobs_remaining: int = 3
    pro_feature: bool = False
    output_exists: bool = True
    abuse_budget_available: bool = True

    @classmethod
    def from_mapping(cls, values: Mapping[str, Any]) -> "Context":
        allowed = {f.name for f in fields(cls)}
        unknown = set(values) - allowed
        if unknown:
            raise ValueError("Unexpected policy fields")
        c = cls(**values)
        if c.action not in ACTIONS or c.entitlement not in STATES:
            raise ValueError("Unknown action or entitlement")
        if type(c.jobs_remaining) is not int or c.jobs_remaining < 0:
            raise ValueError("jobs_remaining must be a nonnegative integer")
        for name in allowed - {"action", "entitlement", "jobs_remaining"}:
            if type(getattr(c, name)) is not bool:
                raise ValueError("Expected boolean field")
        return c

def decide(c: Context) -> str:
    # Existing output never becomes a subscription hostage.
    if c.action in {"view_output", "export_output"}:
        return "allow_output" if c.output_exists else "explain_missing_output"
    if not c.capability_ready:
        return "explain_unavailable"
    if not c.files_ready:
        return "request_files"
    if c.action == "local_quick_action":
        return "execute_local"
    if c.action == "new_cloud_job" and not c.ai_consent:
        return "request_ai_consent"
    if c.action == "new_cloud_job" and not c.network_available:
        return "explain_network_keep_local"
    if not c.entitlement_known:
        return "refresh_entitlement_keep_work"
    if c.entitlement in {"pending", "verifying"}:
        return "verify_purchase_no_duplicate"
    paid = c.entitlement in PAID
    if (c.pro_feature or c.action in {"save_recipe", "replay_recipe"}) and not paid:
        return "offer_pro_keep_work"
    if c.action in {"save_recipe", "replay_recipe"}:
        return "execute_local"
    if not c.abuse_budget_available:
        return "service_limit_keep_local"
    if c.jobs_remaining == 0:
        return "explain_pro_allowance" if paid else "offer_pro_keep_work"
    return "execute_cloud_plan_then_local"
