# @hono/route-spec

Compose route definitions with schema-driven validation & OpenAPI metadata.

- Request validation: `validator('json'|'form'|'query'|'param'|'header'|'cookie')`
- Response validation: `describeResponse(...)`
- Docs metadata: `describeRoute(...)`

```ts
import { Hono } from 'hono'
import { withRouteSpec, type Schema } from '@hono/route-spec'
import { z } from 'zod'

const app = new Hono()

const userSchema = {
  params: z.object({ id: z.string() }),
  query: z.object({ verbose: z.boolean().optional() }),
  responses: {
    200: /* ...StandardSchema... */
  }
} satisfies Schema

app.get(
  '/users/:id',
  ...withRouteSpec(
    {
      summary: 'Get user',
      params: userSchema.params,
      query: userSchema.query,
      responses: userSchema.responses,
    },
    async (c) => {
      return c.json({ ok: true })
    }
  )
)

export default app
```

This package builds on [hono-openapi](https://github.com/rhinobase/hono-openapi)’s describeRoute and describeResponse. See Hono docs for OpenAPI examples.

JS usage (no TypeScript):

- Install and import normally; runtime is plain JS.
- Optionally add JSDoc types:

```js
// @ts-check
import { withRouteSpec } from "@hono/route-spec"

/** @typedef {import('@hono/route-spec').Schema} Schema */
```
