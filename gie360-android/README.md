# GIE360° Android candidate

This project has a separate Android identity from PCC. The client stays under an explicit `https://…/gie360` deployment. No production URL is assumed and no artifact is published to a store or download branch.

Run `.github/workflows/gie360-android.yml` on the same `pcc-validation/…` Git reference used for web validation, providing `gie360_url`. The workflow is also reusable by a coordinated release workflow. An APK build alone does not validate the deployed web version or installation on a device.

For a test candidate, the workflow runs navigation unit tests, compiles a debug APK with application ID `com.pcc.gie360.test`, verifies its signature and writes the SHA-256, commit, version and explicit validation boundaries to `release-manifest.json`. Debug signing is test-only, is not stable between runners and cannot be used as the official release identity.

A signed release must be explicitly requested and all four GitHub secrets must exist: `GIE360_KEYSTORE_BASE64`, `GIE360_KEYSTORE_PASSWORD`, `GIE360_KEY_ALIAS`, `GIE360_KEY_PASSWORD`. The private keystore never enters the repository or artifacts. Gradle rejects release tasks without signing material; it never substitutes a debug key. Keep an independently secured backup of the signing key before distribution.

The icon is copied without reinterpretation from `application/public/gie360/icon-maskable-512.png`; the workflow checks exact parity. Login and logout remain in `/gie360`. Navigation to PCC administration, other origins, HTTP, credentials in URLs, encoded path separators and traversal is blocked. The server still owns authorization and data isolation.

The wrapper provides a system document picker for CSV/XLSX imports; server validation still owns file safety and data quality. Native download handoff and Android real-device tests are not yet implemented or validated by this wrapper. Do not classify it as a distribution-ready APK until import/export flows, offline handling, accessibility, sign-in, session expiry, target-device installation and actual endpoint availability have passed. APK is Android-only; iOS uses the separate PWA.
