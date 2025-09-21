import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { Context, Env, Input, Next } from "hono"
import { describeResponse, describeRoute, validator } from "hono-openapi"
import { HTTPException } from "hono/http-exception"
import type { MiddlewareHandler } from "hono/types"
import type {
  ClientErrorStatusCode,
  ServerErrorStatusCode,
  StatusCode,
} from "hono/utils/http-status"

import type { Schema, WithRouteSpec } from "@/types"

export const withRouteSpec: WithRouteSpec = (schema, handler) => {
  const middleware = [
    describeRoute(schema),
    ...buildValidators(schema),
    makeResponseValidator(schema),
    (c: Context, next: Next) => handler(c, next),
  ] as MiddlewareHandler[]

  return middleware
}

/* =========================
   Implementation helpers
   (runtime-only; no type changes)
   ========================= */

function buildValidators(schema: Schema): MiddlewareHandler[] {
  const m: MiddlewareHandler[] = []
  if (schema.body) m.push(validator("json", schema.body))
  if (schema.form) m.push(validator("form", schema.form))
  if (schema.query) m.push(validator("query", schema.query))
  if (schema.params) m.push(validator("param", schema.params))
  if (schema.headers) m.push(validator("header", schema.headers))
  if (schema.cookies) m.push(validator("cookie", schema.cookies))
  return m
}

function makeResponseValidator<
  E extends Env,
  P extends string,
  I extends Input,
  T extends Partial<Record<StatusCode, StandardSchemaV1>>,
>(schema: Schema<T>): MiddlewareHandler<E, P, I> {
  // @ts-expect-error: hono-openapi's typings for describeResponse are narrower than our middleware generic here
  return describeResponse(async (c, next) => {
    await next()

    const status = c.res.status
    const ct = c.res.headers.get("content-type")?.split(";")[0]
    if (!status || !ct) return

    const resp = schema.responses[status as keyof T]
    if (!resp || !("content" in resp) || !resp.content) return

    const media = resp.content[ct]
    const hasParse =
      // @ts-expect-error vendor schema shape (parseAsync)
      !!media?.vSchema && typeof media.vSchema.parseAsync === "function"
    if (!hasParse) return

    try {
      const data = await readByContentType(c.res, ct)
      if (data === undefined) throw new Error("No data to validate!")
      // @ts-expect-error vendor schema shape (parseAsync)
      await media.vSchema.parseAsync(data)
    } catch (error) {
      const httpExceptionOptions: {
        status: ClientErrorStatusCode | ServerErrorStatusCode
        message: string
      } = { status: 500, message: "Response validation failed!" }

      throw new HTTPException(httpExceptionOptions.status, {
        message: httpExceptionOptions.message,
        cause: error,
      })
    }
  }, schema.responses)
}

function readByContentType(res: Response, ct: string): Promise<unknown> {
  const readers: Record<string, (r: Response) => Promise<unknown>> = {
    "application/json": (r) => r.clone().json(),
    "text/plain": (r) => r.clone().text(),
  }
  const reader = readers[ct]
  return reader ? reader(res) : Promise.resolve(undefined)
}
