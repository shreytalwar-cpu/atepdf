"""Reference-only tests; no network, billing or advertising account access."""
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
OPS = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(OPS))
from preflight import evaluate_launch, REQUIRED_CHECKS

class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026,10,2,12,tzinfo=timezone.utc)
        self.spec = dict(campaign_id='test-only-campaign', account_alias='test-only-account',
            currency='INR', gross_cash_minor=10000, asset_sha256='a'*64,
            landing_version='l1', price_version='p1',
            starts_at='2026-10-02T12:00:00Z', ends_at='2026-10-04T12:00:00Z')
        self.checks={k:True for k in REQUIRED_CHECKS}
        self.approval=dict(schema_version=1,status='approved',approved=True,
            account_alias=self.spec['account_alias'],campaign_id=self.spec['campaign_id'],
            currency='INR',cash_cap_minor=40000,starts_at='2026-10-01T00:00:00Z',
            expires_at='2026-10-07T00:00:00Z',asset_sha256='a'*64,
            landing_version='l1',price_version='p1',approval_evidence_ref='synthetic-reference-only')
    def run_check(self, **kw):
        args=dict(now=self.now,trusted_approval=True,evidence_verified=True)
        args.update(kw)
        return evaluate_launch(self.spec,self.checks,self.approval,**args)
    def blocked(self, reason, **kw):
        result=self.run_check(**kw)
        self.assertEqual(result['status'],'blocked')
        self.assertIn(reason,result['findings'])
        self.assertFalse(result['provider_action_executed'])
    def test_ready_is_reference_only(self):
        r=self.run_check();self.assertEqual(r['status'],'reference_checks_ready')
        self.assertTrue(r['reference_only']);self.assertFalse(r['provider_action_executed'])
    def test_no_approval(self):
        self.approval=None;self.blocked('no_approval')
    def test_untrusted_approval(self): self.blocked('approval_not_authenticated_by_caller',trusted_approval=False)
    def test_unverified_evidence(self): self.blocked('application_evidence_not_verified',evidence_verified=False)
    def test_default_arguments_block(self):
        r=evaluate_launch(self.spec,self.checks,self.approval,now=self.now)
        self.assertEqual(r['status'],'blocked')
    def test_draft_template_blocks(self):
        self.approval=json.loads((OPS/'templates/launch-approval.json').read_text())
        self.blocked('approval_is_draft_or_revoked')
    def test_failed_privacy(self):
        self.checks['privacy_network']=False;self.blocked('check_not_passed:privacy_network')
    def test_failed_rights(self):
        self.checks['creative_rights']=False;self.blocked('check_not_passed:creative_rights')
    def test_failed_purchase(self):
        self.checks['purchase_restore_refund']=False;self.blocked('check_not_passed:purchase_restore_refund')
    def test_wrong_account(self):
        self.approval['account_alias']='wrong';self.blocked('approval_mismatch:account_alias')
    def test_wrong_campaign(self):
        self.approval['campaign_id']='wrong';self.blocked('approval_mismatch:campaign_id')
    def test_wrong_currency(self):
        self.approval['currency']='USD';self.blocked('approval_mismatch:currency')
    def test_changed_asset(self):
        self.spec['asset_sha256']='b'*64;self.blocked('approval_mismatch:asset_sha256')
    def test_changed_landing(self):
        self.spec['landing_version']='l2';self.blocked('approval_mismatch:landing_version')
    def test_changed_price(self):
        self.spec['price_version']='p2';self.blocked('approval_mismatch:price_version')
    def test_cap_includes_spent_and_reserved(self):
        self.blocked('gross_cash_cap_exceeded',already_spent_minor=25000,reserved_minor=6000)
    def test_exact_cap_ready(self):
        self.assertEqual(self.run_check(already_spent_minor=25000,reserved_minor=5000)['status'],'reference_checks_ready')
    def test_zero_cap(self):
        self.approval['cash_cap_minor']=0;self.blocked('gross_cash_cap_exceeded')
    def test_zero_budget(self):
        self.spec['gross_cash_minor']=0;self.blocked('zero_requested_budget')
    def test_expired_approval(self):
        self.blocked('approval_not_current',now=datetime(2026,10,8,tzinfo=timezone.utc))
    def test_approval_not_yet_current(self):
        self.blocked('approval_not_current',now=datetime(2026,9,30,tzinfo=timezone.utc))
    def test_extends_approval_window(self):
        self.spec['ends_at']='2026-10-09T12:00:00Z';self.blocked('campaign_outside_approval_window')
    def test_unknown_payload_rejected(self):
        self.spec['raw_prompt']='forbidden'
        with self.assertRaises(ValueError):self.run_check()
    def test_incomplete_checks_rejected(self):
        del self.checks['claims']
        with self.assertRaises(ValueError):self.run_check()
    def test_truthy_string_rejected(self):
        self.checks['claims']='true'
        with self.assertRaises(ValueError):self.run_check()
    def test_boolean_budget_rejected(self):
        self.spec['gross_cash_minor']=True
        with self.assertRaises(ValueError):self.run_check()
    def test_negative_spend_rejected(self):
        with self.assertRaises(ValueError):self.run_check(already_spent_minor=-1)
    def test_naive_time_rejected(self):
        self.spec['starts_at']='2026-10-02T12:00:00'
        with self.assertRaises(ValueError):self.run_check()
    def test_reversed_window_rejected(self):
        self.spec['ends_at']=self.spec['starts_at']
        with self.assertRaises(ValueError):self.run_check()
    def test_bad_hash_rejected(self):
        self.spec['asset_sha256']='not-a-hash'
        with self.assertRaises(ValueError):self.run_check()
    def test_missing_evidence_reference(self):
        self.approval['approval_evidence_ref']=None;self.blocked('missing_approval_evidence')
    def test_unknown_approval_field_rejected(self):
        self.approval['api_key']='not-allowed'
        with self.assertRaises(ValueError):self.run_check()

if __name__=='__main__':unittest.main(verbosity=2)
