---
id: BUGFIX-01
epic: EPIC-01
status: done
pr: 6
---

# Retry the post-deploy header check until the edge serves the new deploy

## User story
As the maintainer, I want the post-deploy header check to wait for Cloudflare's edge to serve the new deploy, so that a good deploy does not fail CI.

## Context
Run 42874121135 failed at "Assert security headers" 0.1 s after `wrangler deploy` returned. Every CSP, COOP and COEP header was reported MISSING on `/`, but a `curl` seconds later showed them all. Related story: STORY-05 (AC8).

## Acceptance criteria
1. Given the edge still serves the previous version right after a deploy, when the header check runs, then it retries (12 attempts, 5 s apart) and passes once the new version serves the headers.
2. Given the headers never appear, when the retries run out, then the job fails and names each missing header.
