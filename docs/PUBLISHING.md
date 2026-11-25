# Publishing

## npm

The package publishes as `layout-circular`. Releases ride tags: bump the
version, tag `v<version>`, push the tag, and
`.github/workflows/release.yml` runs the tests and lint, then
publishes with provenance. The workflow skips cleanly if the version
is already on the registry. Trusted publishing needs npm 11.5.1 or
later and Node 22.14 or later, so the workflow upgrades npm first.

One-time setup, in order. The package has never been published.

1. First publish happens locally. npm's documentation says a
   package must already exist on the registry before a trusted
   publisher can be configured for it (the `npm trust` page states
   it outright). The npm trusted-publishers page doesn't mention
   unpublished packages either way, and npm has no "pending
   publisher" feature that we could confirm. So: `npm login`, then
   `npm publish --access public` from a clean checkout of main at
   the version to release. This was checked against npm's
   documentation on 2026-11-25; if npm has since changed it, the
   settings page will say so, and this step can be skipped.
2. On npmjs.com: package → Settings → Trusted publisher → GitHub
   Actions, repository `AndrewBroz/layout-circular`, workflow
   `release.yml`. After this, no tokens exist anywhere.
3. Within 2 days of saving the trusted publisher, publish a new
   version from the workflow. npm gives a new configuration 2 days
   to complete its first successful publish, then expires it, and an
   expired configuration can't be used or edited. Re-running an old
   tag doesn't count, because the workflow skips versions already on
   the registry. Bump the patch version, tag it, push the tag.
