# Cinema navigation origin binding

The Workroom navigation proposal now includes `browser_allowed_origins` equal to the parsed HTTPS destination origin before Compose/request approval. The exact full destination URL remains in the signed payload. No wildcard, second site or execution authority is added; existing pending requests are not rewritten.

This follows the existing Cinema sequential execution contract. It is separate from the demonstrated Unicode hash failure in Private Runtime PR842. Current Cinema source can infer navigation origin from the URL, so omission is not claimed to be the cause of that observed failure.

Regression: an HTTPS URL with a nondefault port, path, query and fragment must bind only `https://example.test:8443` as its origin and preserve the full target URL. The test failed for the missing field before the fix; all26 focused local tests and strict component TypeScript pass after it. Exact-head CI/deployed-source verification remain required. No live task completion is inferred.

UI release PR258 is already serving source `3def27aa085a29432a7f48fa2bfc1065ef77da51`, image `sha256:6e6e49d465fed633c74bad4fafd2029262388188729c376b24a2e7f6c5306544`, observed through Goal-first status HTTP200 at2026-10-25T18:19:50.116Z after Ship40220605929 succeeded. Fresh public captures show the new homepage and mobile login retaining `/dsg/workroom?tool=browser`. This is public appearance/redirect/deployment proof, not authenticated work or complete Agent/Cinema/Native E2E.

