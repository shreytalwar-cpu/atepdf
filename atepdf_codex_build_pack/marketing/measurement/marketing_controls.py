"""Reference-only planning controls. This file does not dispatch events or modify campaigns."""
from __future__ import annotations
import math
import re
from typing import Any, Mapping

ALLOWED_EVENTS = {"LandingView", "Activated", "CheckoutOpened", "FirstPurchase"}
ALLOWED_FIELDS = {"event_name", "event_id", "event_time", "campaign_id", "creative_id", "market", "platform", "currency", "value"}
TOKEN = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
CURRENCIES = {"INR", "USD", "GBP", "EUR", "CAD", "AUD"}
MARKETS = {"US", "IN", "CA", "GB", "AU", "OTHER"}
PLATFORMS = {"web", "ios", "android", "mac"}

def _number(x: Any) -> float:
    if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) or x < 0:
        raise ValueError("Expected a nonnegative finite number")
    return float(x)

def safe_event(payload: Mapping[str, Any], *, consent: bool, verified: bool=False,
               first_payment: bool=False, provider_state: str="") -> dict[str, Any] | None:
    """Strict example allowlist, not a provider-ready payload or a legal consent implementation."""
    if consent is not True:
        return None
    if set(payload) - ALLOWED_FIELDS:
        raise ValueError("Forbidden event fields")
    name = payload.get("event_name")
    if name not in ALLOWED_EVENTS:
        raise ValueError("Unknown event")
    if not TOKEN.fullmatch(str(payload.get("event_id",""))):
        raise ValueError("Invalid event ID")
    for field in ("campaign_id", "creative_id"):
        if field in payload and not TOKEN.fullmatch(str(payload[field])):
            raise ValueError("Invalid categorical identifier")
    for field, choices in (("market",MARKETS),("platform",PLATFORMS),("currency",CURRENCIES)):
        if field in payload and payload[field] not in choices:
            raise ValueError("Invalid category")
    if "event_time" in payload:
        _number(payload["event_time"])
    if "value" in payload:
        _number(payload["value"])
    if name == "FirstPurchase":
        if not (verified and first_payment and provider_state == "paid"):
            return None
        if "currency" not in payload or "value" not in payload:
            raise ValueError("Purchase missing currency or value")
    return dict(payload)

def budget_net(gross_media: float, tax_rate: float) -> tuple[float,float]:
    gross, rate = _number(gross_media), _number(tax_rate)
    net = gross/(1+rate)
    return net, gross-net

def cash_cac(media_cash: float, creative_cash: float, other_cash: float, first_buyers: int) -> float | None:
    if isinstance(first_buyers,bool) or not isinstance(first_buyers,int) or first_buyers<0:
        raise ValueError("First buyers must be a nonnegative integer")
    spend = sum(_number(x) for x in (media_cash,creative_cash,other_cash))
    return spend/first_buyers if first_buyers else None

def recommend_review(*, approved: bool, healthy: bool, mature: bool, spend: float,
                     first_buyers: int, target_cac: float) -> str:
    """Returns a human-review suggestion only; never executes an ad-account mutation."""
    budget = _number(spend); target = _number(target_cac)
    if target == 0: raise ValueError("Target must be positive")
    if not approved: return "NOT_APPROVED"
    if not healthy: return "URGENT_PAUSE_REVIEW"
    if not mature: return "WAIT_FOR_COHORT"
    observed = cash_cac(budget,0,0,first_buyers)
    if observed is None:
        return "PAUSE_REVIEW" if budget >= 3*target else "INSUFFICIENT_DATA"
    if observed > target: return "ABOVE_TARGET_REVIEW"
    return "REVIEW_FOR_REPLICATION"
