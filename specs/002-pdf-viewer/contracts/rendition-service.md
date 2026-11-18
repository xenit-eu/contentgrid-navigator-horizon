# Contract: Rendition service (as consumed; to be confirmed with the platform team, ACC-2960)

**Status**: observed behaviour of the production Navigator, plus the platform's confirmed answers on
authentication and configuration (spec Clarifications). Items marked _confirm_ are open.

## Configuration

- `renditionUri`: URI template, e.g. `https://renditions.<zone>.contentgrid.cloud/renditions/get/pdf{?url}`.
  Delivered per deployment (Liaison `config.js` → `v1.renditionUri`; env fallback).
- The `url` parameter value is the content attribute's `cg:content` href, passed opaque.

## Authentication

Every request (initial and polls) is made with the same authenticated content client the viewer uses
for downloads, with the Bearer token in the `Authorization` header only. The rendition service is on
another origin, so it gets an extension token, not the user's access token: the client exchanges the
user's token at `<application origin>/.contentgrid/authentication/external/token` (grant type
`https://contentgrid.cloud/oauth2/grant/extension-token`, `resource` = the request URL) and caches the
result per user and origin until shortly before it expires (ACC-3292). _Confirm_: the service's CORS
policy allows the Navigator origin with an `Authorization` header.

## Request / response

| Step     | Request                       | Expected responses                                                                                                                                                                                                                           |
| -------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initiate | `GET <renditionUri expanded>` | `202 Accepted` + `Location: <job url>` (job created); `200 OK` `application/pdf` (already available, _confirm_); `application/problem+json` with `type` `…/problems/renditions/invalid-conversion` (cannot convert); other 4xx/5xx = failure |
| Poll     | `GET <job url>`               | `202` (pending, poll again after `intervalMs`); `200 OK` `application/pdf` body; problem `invalid-conversion`; other = failure                                                                                                               |

- Polling stops at the first terminal response, on abort, or when `now ≥ start + timeoutMs`.
- _Confirm_: `Access-Control-Expose-Headers: Location` and CORS allowing the Navigator origin with
  `Authorization`; whether `Retry-After` is sent (would replace the fixed interval); whether a
  4xx problem replaces today's 500 when the source cannot be fetched (ACC-3074).

## Problem types handled

| Type                                                               | Frontend behaviour                                 |
| ------------------------------------------------------------------ | -------------------------------------------------- |
| `https://contentgrid.cloud/problems/renditions/invalid-conversion` | "Preview not available" + Download (not an error)  |
| any other problem / status                                         | "Preview could not be prepared" + Retry + Download |
| no terminal answer within `timeoutMs`                              | same as above (`RenditionTimeoutError`)            |
