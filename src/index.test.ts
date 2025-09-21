import { expect, test } from "vitest"
import { Hono } from "hono"
import { openAPIRouteHandler } from "hono-openapi"
import z from "zod/v4"

import { type Schema, withRouteSpec } from "."

test("withRouteSpec validates query/body and response payload", async () => {
  const schema = {
    summary: "Create item",
    query: z.object({
      count: z.coerce.number().int().min(1),
    }),
    body: z.object({
      name: z.string().min(1),
    }),
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            vSchema: z.object({
              success: z.literal(true),
              count: z.number(),
              name: z.string(),
            }),
          },
        },
      },
    },
  } satisfies Schema

  const app = new Hono()

  app.post(
    "/items",
    ...withRouteSpec(schema, async (c) => {
      const query = c.req.valid("query")
      const body = c.req.valid("json")

      expect(query.count).toBe(2)
      expect(body.name).toBe("Widget")

      return c.json({
        success: true,
        count: query.count,
        name: body.name,
      })
    })
  )

  const response = await app.request("/items?count=2", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Widget" }),
  })

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual({
    success: true,
    count: 2,
    name: "Widget",
  })
})

test("withRouteSpec short-circuits when query validation fails", async () => {
  const schema = {
    query: z.object({
      count: z.coerce.number().int().min(1),
    }),
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            vSchema: z.object({ ok: z.boolean() }),
          },
        },
      },
    },
  } satisfies Schema

  const app = new Hono()
  let called = false

  app.get(
    "/items",
    ...withRouteSpec(schema, (c) => {
      called = true
      return c.json({ ok: true })
    })
  )

  const response = await app.request("/items?count=abc")

  expect(response.status).toBe(400)
  expect(called).toBe(false)
})

test("withRouteSpec validates response payloads", async () => {
  const schema = {
    responses: {
      200: {
        description: "Response schema",
        content: {
          "application/json": {
            vSchema: z.object({
              ok: z.literal(true),
            }),
          },
        },
      },
    },
  } satisfies Schema

  const app = new Hono()

  app.get(
    "/health",
    // @ts-expect-error testing invalid response
    ...withRouteSpec(schema, (c) => c.json({ ok: false }))
  )

  const response = await app.request("/health")

  expect(response.status).toBe(500)
  await expect(response.text()).resolves.toContain(
    "Response validation failed!"
  )
})

test("withRouteSpec enforces param validation", async () => {
  const schema = {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    responses: {
      200: {
        description: "Param validated",
        content: {
          "application/json": {
            vSchema: z.object({ id: z.number().int().positive() }),
          },
        },
      },
    },
  } satisfies Schema

  const app = new Hono()
  let seen: number | undefined

  app.get(
    "/items/:id",
    ...withRouteSpec(schema, (c) => {
      const params = c.req.valid("param")
      seen = params.id
      return c.json({ id: params.id })
    })
  )

  const invalid = await app.request("/items/0")
  expect(invalid.status).toBe(400)
  expect(seen).toBeUndefined()

  const valid = await app.request("/items/42")
  expect(valid.status).toBe(200)
  await expect(valid.json()).resolves.toEqual({ id: 42 })
  expect(seen).toBe(42)
})

test("withRouteSpec registers docs consumable by openAPIRouteHandler", async () => {
  const schema = {
    summary: "List products",
    description: "Fetches all products",
    tags: ["products"],
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            vSchema: z.object({
              data: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                })
              ),
            }),
          },
        },
      },
    },
  } satisfies Schema

  const router = new Hono()
  router.get(
    "/products",
    ...withRouteSpec(schema, (c) =>
      c.json({
        data: [
          { id: "1", name: "Widget" },
          { id: "2", name: "Gadget" },
        ],
      })
    )
  )

  const docs = new Hono()
  docs.get(
    "/openapi.json",
    openAPIRouteHandler(router, {
      documentation: {
        info: {
          title: "Test API",
          version: "1.0.0",
        },
      },
    })
  )

  const response = await docs.request("/openapi.json")

  expect(response.status).toBe(200)
  const spec = (await response.json()) as {
    paths?: Record<
      string,
      {
        get?: {
          summary?: string
          responses?: Record<string, unknown>
        }
      }
    >
  }

  expect(spec.paths?.["/products"]?.get).toBeDefined()
  expect(spec.paths?.["/products"]?.get?.summary).toBe("List products")
  expect(
    spec.paths?.["/products"]?.get?.responses &&
      "200" in spec.paths["/products"].get!.responses!
  ).toBe(true)
})
