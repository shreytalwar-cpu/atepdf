"""Tests of the reference serializer only; not browser/network/app tests."""
import json, sys, unittest
from copy import deepcopy
from pathlib import Path
from jsonschema import ValidationError
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'reference'))
from serialize_planner_request import build_request

class RequestBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.request=json.loads((ROOT/'examples/hero.request.json').read_text())
        self.workspace=deepcopy(self.request)
    def build(self, **kw):
        args=dict(workspace=self.workspace,instruction=self.request['instruction'],request_id='req_test',ai_consent=True)
        args.update(kw);return build_request(**args)
    def test_expected_fields_only(self):
        got=self.build();expected=deepcopy(self.request);expected['requestId']='req_test';self.assertEqual(got,expected)
    def test_metadata_excludes_local_files_and_previews(self):
        for f in self.workspace['files']:
            f.update(filename='private-name.pdf',fullPath='/private/source',bytes=b'PDF',preview='data:image/png;base64,private',ocrText='SECRET_CANARY')
        text=json.dumps(self.build());self.assertNotIn('SECRET_CANARY',text);self.assertNotIn('private-name',text)
        self.assertNotIn('data:image',text);self.assertNotIn('/private',text)
    def test_top_level_state_not_serialised(self):
        self.workspace.update(messages=[{'content':'PRIVATE_HISTORY'}],blobs=b'pdf',apiKey='PRIVATE_KEY',uiState={'thumb':'PRIVATE_THUMB'})
        text=json.dumps(self.build());self.assertNotIn('PRIVATE_',text)
    def test_no_consent(self):
        for value in [False,None,'yes',1]:
            with self.subTest(value=value),self.assertRaises(PermissionError):self.build(ai_consent=value)
    def test_instruction_type_rejected(self):
        with self.assertRaises(ValidationError):self.build(instruction={'file':'content'})
    def test_instruction_is_explicitly_sent_not_a_dlp_claim(self):
        self.assertEqual(self.build(instruction='User chosen text')['instruction'],'User chosen text')
    def test_wrong_metadata_type_rejected(self):
        self.workspace['files'][0]['pageCount']='data:application/pdf;base64,private'
        with self.assertRaises(ValidationError):self.build()
    def test_nested_prior_plan_secret_rejected(self):
        self.workspace['previousPlan']={'steps':[],'resultRefs':[],'password':'PRIVATE'}
        with self.assertRaises(ValidationError):self.build()
    def test_snapshot_is_not_mutated(self):
        before=deepcopy(self.workspace);self.build();self.assertEqual(before,self.workspace)
    def test_result_is_independent_snapshot(self):
        got=self.build();got['files'][0]['pageCount']=999;self.assertNotEqual(self.workspace['files'][0]['pageCount'],999)
    def test_files_container_must_be_list(self):
        self.workspace['files']={'file':'not-a-list'}
        with self.assertRaises(TypeError):self.build()
    def test_missing_required_field_rejected(self):
        del self.workspace['workspaceRevision']
        with self.assertRaises(ValidationError):self.build()

if __name__=='__main__':unittest.main(verbosity=2)
