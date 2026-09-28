import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"measurement"))
from marketing_controls import safe_event,budget_net,cash_cac,recommend_review

class Controls(unittest.TestCase):
    def purchase(self):
        return dict(event_name="FirstPurchase",event_id="order_123",currency="USD",value=39.99,market="US",platform="web")
    def test_01_default_no_live_spend(self):
        cfg=json.loads((ROOT/"campaigns/campaign_draft.json").read_text())
        self.assertFalse(cfg["enable_paid_spend"]);self.assertFalse(cfg["enable_publication"])
    def test_02_cash_envelope(self):
        b=json.loads((ROOT/"campaigns/campaign_draft.json").read_text())["budget"]
        self.assertEqual(sum(b["gross_media_tranches"])+b["creative_research_cash"]+b["held_cash"],b["max_total_cash"])
    def test_03_net_media(self):
        n,t=budget_net(24000,.18)
        self.assertAlmostEqual(n,20338.98305084746);self.assertAlmostEqual(n+t,24000)
    def test_04_consent_denied(self):
        self.assertIsNone(safe_event(self.purchase(),consent=False,verified=True,first_payment=True,provider_state="paid"))
    def test_05_verified_purchase(self):
        self.assertEqual(safe_event(self.purchase(),consent=True,verified=True,first_payment=True,provider_state="paid")["value"],39.99)
    def test_06_pending(self):
        self.assertIsNone(safe_event(self.purchase(),consent=True,verified=True,first_payment=True,provider_state="pending"))
    def test_07_renewal(self):
        self.assertIsNone(safe_event(self.purchase(),consent=True,verified=True,first_payment=False,provider_state="paid"))
    def test_08_unverified(self):
        self.assertIsNone(safe_event(self.purchase(),consent=True,first_payment=True,provider_state="paid"))
    def test_09_content_fields(self):
        for field in ["prompt","filename","pdf_bytes","ocr_text","email"]:
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    safe_event({**self.purchase(),field:"private"},consent=True)
    def test_10_url_not_category(self):
        with self.assertRaises(ValueError):safe_event({**self.purchase(),"campaign_id":"https://bad.test/private.pdf"},consent=True)
    def test_11_invalid_numbers(self):
        for n in [float("nan"),float("inf"),-1,True]:
            with self.subTest(n=n):
                with self.assertRaises(ValueError):budget_net(n,.18)
    def test_12_zero_buyer_cac(self):
        self.assertIsNone(cash_cac(4000,1000,0,0))
    def test_13_loaded_cac(self):
        self.assertEqual(cash_cac(24000,8000,0,40),800)
    def test_14_no_approval(self):
        self.assertEqual(recommend_review(approved=False,healthy=True,mature=True,spend=100,first_buyers=10,target_cac=700),"NOT_APPROVED")
    def test_15_maturity_and_incident(self):
        self.assertEqual(recommend_review(approved=True,healthy=True,mature=False,spend=4000,first_buyers=0,target_cac=700),"WAIT_FOR_COHORT")
        self.assertEqual(recommend_review(approved=True,healthy=False,mature=True,spend=100,first_buyers=10,target_cac=700),"URGENT_PAUSE_REVIEW")
    def test_16_zero_purchase_review(self):
        self.assertEqual(recommend_review(approved=True,healthy=True,mature=True,spend=2100,first_buyers=0,target_cac=700),"PAUSE_REVIEW")

if __name__=="__main__":unittest.main(verbosity=2)
