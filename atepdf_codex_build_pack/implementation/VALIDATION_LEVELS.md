# Evidence levels: do not collapse these into one Done label

| Evidence | What it proves | What it does not prove |
|---|---|---|
| Archive CRC, hashes and required paths | Download/extraction completeness and source preservation | Product functionality |
| Existing schema/reference validator cases | Consistency of supplied protocol examples and reference semantics | Live model accuracy or app-side validation |
| Reference request-boundary unit tests | Supplied Python builder omits extra local state and enforces its schema | Actual browser/native serialization, secret detection or network privacy |
| Startup fixture parse/render checks | Synthetic input pages are valid, readable and have intended text/raster structure | The app can merge, OCR, compress or export them |
| Application integration tests | Specific implementation behaviours on a named commit/runtime | Other untested platforms or universal PDF compatibility |
| Live model eval | A specified model/config on held-out command cases | Every prompt or future model version |
| Sandbox store tests | Specified purchase/lifecycle paths in test environment | Production merchant approval or all regional rules |
| Production privacy/security review | Tested build/configuration and identified controls | A guarantee that no defect can ever exist |
| Paying-user cohorts | Observed conversion, usage, refunds and renewals | Assumed forecasts before cohorts exist |

The final package reports the first four where actually performed. The remaining levels are implementation work. Keep each status explicit.
