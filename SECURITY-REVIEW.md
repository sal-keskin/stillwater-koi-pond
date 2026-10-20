# Source review and adaptation notes

Reviewed 20 October 2026. The downloaded upstream snapshot contained 13 text files and no installed dependencies, lockfile, binary payloads, symlinks, install hooks, Git hooks, or workflows. Complete static review of the original implementation found no malicious behavior, credential access, dynamic code execution, or application data uploads. This was a source review, not a guarantee of safety or a malware scanner certification.

Upstream was subsequently identified as https://github.com/stackedlol/ascii-sharks at commit c521e24a787e6d4cc460d4cf2b9815f25e4fe453. No license was present.

The koi adaptation removes the demo's Google Fonts request and unvalidated shark query parameter. It uses a separate pond engine and procedural Web Audio, preserving the original shark modules as reference. Production bundles contain no third-party runtime imports. Clipboard access occurs only when the user clicks Copy embed code.

Build dependencies are now pinned to TypeScript 5.9.3 and Vite 6.4.4, with a lockfile. Installation used `--ignore-scripts`; npm's installation audit reported zero known vulnerabilities. This is a point-in-time advisory result; re-audit before future deployment. Vite's 6.4.4 release includes the fix for [GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22). Keep the development server local and deploy the production build.
