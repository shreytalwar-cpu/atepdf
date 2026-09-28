#!/usr/bin/env python3
"""Synthetic path-boundary tests. These do not access the owner's old repo."""
from pathlib import Path
import hashlib, json, sys, tempfile, unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'reference'))
from guard import assess_roots, BoundaryError

class GuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.new = self.root / 'atepdf'
        self.old = self.root / 'AttenloPDF'
        self.new.mkdir(); self.old.mkdir()
    def tearDown(self): self.temp.cleanup()
    def error(self, code, new=None, old=None):
        with self.assertRaisesRegex(BoundaryError, '^'+code+'$'):
            assess_roots(new or self.new, old if old is not None else self.old)
    def marker(self, **kwargs):
        val={'product':'atepdf','build_origin':'fresh_repository','status':'initialized'};val.update(kwargs)
        (self.new/'.atepdf-project.json').write_text(json.dumps(val))
    def test_distinct_empty(self): self.assertTrue(assess_roots(self.new,self.old)['boundary_check_passed'])
    def test_same_root(self): self.error('SAME_ROOT', self.old)
    def test_new_within_old(self): self.error('NEW_INSIDE_LEGACY', self.old/'child')
    def test_new_contains_old(self): self.error('NEW_CONTAINS_LEGACY', self.root)
    def test_symlink_to_old(self):
        link=self.root/'alias';link.symlink_to(self.old,target_is_directory=True);self.error('SAME_ROOT',link)
    def test_symlink_into_old_child(self):
        child=self.old/'child';child.mkdir();link=self.root/'alias';link.symlink_to(child,target_is_directory=True);self.error('NEW_INSIDE_LEGACY',link)
    def test_parent_git(self):
        (self.root/'.git').mkdir();self.error('PARENT_GIT_REPOSITORY')
    def test_linked_worktree(self):
        (self.new/'.git').write_text('gitdir: PRIVATE_PATH');self.error('LINKED_GIT_ROOT_REQUIRES_REVIEW')
    def test_git_symlink(self):
        target=self.root/'gitdata';target.mkdir();(self.new/'.git').symlink_to(target,target_is_directory=True);self.error('LINKED_GIT_ROOT_REQUIRES_REVIEW')
    def test_no_legacy_source(self):
        x=assess_roots(self.new);self.assertEqual(x['legacy_reference_status'],'not_supplied');self.assertFalse(x['new_scaffold_blocked_by_missing_legacy'])
    def test_missing_legacy_path(self):
        x=assess_roots(self.new,self.root/'missing');self.assertEqual(x['legacy_reference_status'],'path_unavailable_learning_pending')
    def test_nonexistent_new_root(self):
        p=self.root/'future';self.assertEqual(assess_roots(p,self.old)['destination_state'],'new_directory_not_yet_created');self.assertFalse(p.exists())
    def test_nonempty_unverified_target(self):
        (self.new/'app.ts').write_text('do not delete');self.error('NONEMPTY_UNVERIFIED_DESTINATION')
    def test_resume_new_project(self):
        self.marker();(self.new/'app.ts').write_text('new code');self.assertIn('resume',assess_roots(self.new,self.old)['destination_state'])
    def test_marker_is_template(self):
        self.marker(status='template_not_created_in_application');self.error('TEMPLATE_MARKER_NOT_INITIALIZED')
    def test_wrong_marker(self): self.marker(product='oldapp');self.error('WRONG_PROJECT_MARKER')
    def test_broken_marker(self):
        (self.new/'.atepdf-project.json').write_text('broken');self.error('INVALID_PROJECT_MARKER')
    def test_handoff_only(self):
        (self.new/'handoff').mkdir();(self.new/'.DS_Store').write_bytes(b'');self.assertTrue(assess_roots(self.new,self.old)['boundary_check_passed'])
    def test_new_root_is_file(self):
        p=self.root/'plain';p.write_text('x');self.error('NEW_ROOT_NOT_DIRECTORY',p)
    def test_legacy_root_is_file(self):
        p=self.root/'plain';p.write_text('x');self.error('LEGACY_ROOT_NOT_DIRECTORY',old=p)
    def test_relative_root(self): self.error('ABSOLUTE_PATH_REQUIRED',Path('atepdf'))
    def test_root_directory(self): self.error('FILESYSTEM_ROOT_NOT_A_PROJECT',Path(self.root.anchor))
    def test_no_mutations_or_private_path_output(self):
        sentinel=self.old/'source.txt';sentinel.write_text('synthetic source')
        before={p.relative_to(self.root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.rglob('*') if p.is_file()}
        report=assess_roots(self.new,self.old)
        after={p.relative_to(self.root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before,after);self.assertNotIn(str(self.root),json.dumps(report));self.assertFalse(report['os_read_only_permission_verified'])
    def test_new_git_directory_not_a_parent(self):
        (self.new/'.git').mkdir();self.assertTrue(assess_roots(self.new,self.old)['boundary_check_passed'])

if __name__=='__main__': unittest.main(verbosity=2)
