# atepdf: approved name and logo
**Owner-approved brand decision | 28 September 2026 | v6**

## The decision is final
The public product name is **atepdf**, exactly one word and all lowercase. The paid plan is **atepdf Pro**. Use the approved rounded gradient **numeral 8** as the logo. The icon is an eight, not an A, infinity sign, paper character, biting mouth or stylised PDF.

The attached board is approved for **name and logo identity only**. The user's explicit instruction is to **ignore the mock-ups**. No product layout, navigation, feature list, phone home screen, splash screen, fake loading sequence or onboarding shown in that board becomes a requirement.

## Two sources, two distinct scopes
| Decision | Source of truth |
|---|---|
| Name and logo identity | [Owner-supplied brand board](reference/approved-atepdf-brand-board.jpeg) and [brand config](brand.json) |
| Product UI and interactions | [Existing design contract](../DESIGN.md) and the original iPhone/iPad references in `design/references/` |
| Capabilities, billing, local processing and marketing | Existing technical, growth and marketing instructions; this change adds no features |

The older UI images remain unchanged as historical source pixels. Replace their visible Attenlo PDF/A-logo branding in the real implementation with atepdf/the 8. Preserve the file-drop area, instruction box, contextual file/results and three shortcuts. Keep the existing friendly paper illustration as optional empty-state artwork, not as an alternate logo.

## Mark and wordmark
- Match the supplied upright, rounded 8 silhouette and blue/violet/pink gradient, including the unequal upper/lower bowls and two open counters. Do not substitute a font glyph and claim that it is the approved artwork.
- Wordmark text is `atepdf`. Match the supplied dark navy `ate` and quieter slate `pdf` appearance when reproducing the approved lockup. Do not retype it in an arbitrary font and label it an exact asset.
- Use the numeral alone where a compact app icon/favicon is needed and the wordmark where the product name must be readable. Do not put the parent studio's A mark back into the product header.
- Do not redesign the rest of the palette to match a new mock-up. Existing interface tokens are retained; a logo gradient does not require gradients on every control.
- The source includes icon background variations. They are references, not a new request for three themes or an already finalised store-icon asset set.
- The reference line “Small tools. Big possibilities.” may inform marketing, but it is not a new mandatory above-the-fold UI element or evidence of any unbuilt capability. Keep the functional promise and local-processing explanation clear.

## Asset truthfulness
The supplied original is a **670 × 1024 JPEG board**. It is included unchanged. Three PNG source-pixel crops isolate the main mark, wordmark and lockup for implementation reference. Their original background is retained. They have not been redrawn, upscaled, background-removed or converted to vector.

These are **not production SVGs, transparent master assets or App Store submission icons**. No exact font family was identified. No font file is distributed. Before public release, derive clean platform-appropriate assets from this reference, inspect them against the approved silhouette/colours and record the evidence. Use only appropriately licensed resources. Do not invent new logo options or pause unrelated engineering while asset exports are prepared.

See [asset-manifest.json](asset-manifest.json) for source hashes and crop coordinates. A changed rendition is implementation work to verify, not silently owner-approved artwork.

## Where to apply the identity
Use the central name/assets in the app header, browser title, install/PWA metadata, display names, accessibility labels, read-only viewer chrome, account/plan screens, onboarding, paywalls, help, landing pages, ads, email and social drafts. Use natural copy such as “Tell atepdf what to do…” and “Open atepdf”. New marketing material must not use Attenlo PDF as the current product name.

**Fresh-build identity rule (v7).** This is a new atepdf product repository, not a display-name migration of Attenlo PDF. Create independent development namespaces, app-private storage and sandbox settings. Do not automatically inherit old bundle IDs, app groups, keychain groups, OAuth applications, analytics projects, purchase SKUs or customer entitlements. Any production reuse/migration requires explicit approval. Historical handoff filenames, fixture labels and wire-contract IDs containing `attenlo` may remain as provenance; they are not live product identities. The studio remains Attenlo Labs; no legal seller is chosen by this branding decision.

## Domain and publication
No verified public domain, support email, trademark clearance, merchant account or legal entity is established by approving the logo. Keep these values configurable and unset until supplied/verified. Do not invent `atepdf.com`, email addresses or new paid products. All publication, billing and spending approval boundaries stay unchanged.

## Precedence
This file overrides older branding statements such as “working name,” “no name finally approved,” or instructions to reproduce the old A mark. It does not override repository safety rules, product scope, privacy, pricing hypotheses or the approved interaction design. Older financial workbooks and source reports keep their original names for auditability; treat their product label as historical rather than changing the numbers or rebuilding the files.
