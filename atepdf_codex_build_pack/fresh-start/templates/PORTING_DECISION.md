# Selective porting decision

Default decision: learn and reimplement. Fill a row only for an isolated helper or authorised synthetic test worth porting; this is not permission to copy an application.

| Field | Required entry |
|---|---|
| Port ID / related learning ID | Pending |
| Exact old path and commit/snapshot | Pending |
| Owner/third-party provenance and licence | Pending |
| Why this isolated port is better than clean reimplementation | Pending |
| Intended destination in NEW atepdf source | Pending |
| Dependency list, size and app-coupling assessment | Pending |
| Secrets/private data/production config inspection | Not run |
| Minimal changes and preserved notices | Pending |
| New regression test and independent result | Not run |
| Runtime independence from old source | Not run |
| Approval required for licence or material scope? | Pending |
| Final disposition | Not ported |

Do not copy private source dumps into marketing tools. Reject a candidate that needs the old navigation, global state container, database or root build pipeline. Owner-controlled code can be reused; fresh architecture remains the default.
