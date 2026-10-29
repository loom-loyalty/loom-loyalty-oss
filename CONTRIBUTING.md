# Contributing

Thanks for helping improve the Loom Loyalty open-source packages.

## How this repository works

This repository is published from Loom Loyalty's private monorepo once a week. A pull request opened here is reviewed here, then applied to the monorepo, and the change arrives back in the next weekly sync. Your pull request is closed with a link to that sync, and you stay credited as a co-author of the commit.

## Before you open a pull request

1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Run `pnpm install`, `pnpm build`, `pnpm type-check`, `pnpm lint` and `pnpm test`.
3. Add a changeset (`pnpm changeset`) when your change affects a published package.

## Sign your commits (DCO)

Every commit must carry a `Signed-off-by` line, which certifies the [Developer Certificate of Origin](https://developercertificate.org/): that you wrote the change or have the right to submit it under the Apache License 2.0. Add it with:

```bash
git commit -s
```

A check fails pull requests whose commits are not signed off.

## Reporting security issues

Please do not open public issues for security problems. See [SECURITY.md](SECURITY.md).
