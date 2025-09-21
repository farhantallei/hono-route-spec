import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { Context, Env, Input, Next } from "hono"
import type {
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from "hono/types"
import type { StatusCode } from "hono/utils/http-status"
import type { OpenAPIV3_1 } from "openapi-types"

type ResponseObject<T extends Partial<Record<StatusCode, StandardSchemaV1>>> = {
  [K in keyof T]:
    | OpenAPIV3_1.ReferenceObject
    | (OpenAPIV3_1.ResponseObject & {
        content?: {
          [media: string]: OpenAPIV3_1.MediaTypeObject & {
            vSchema?: T[K]
          }
        }
      })
}

export type Schema<
  T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<
    Record<StatusCode, StandardSchemaV1>
  >,
  JsonSchema extends StandardSchemaV1 = StandardSchemaV1,
  FormSchema extends StandardSchemaV1 = StandardSchemaV1,
  QuerySchema extends StandardSchemaV1 = StandardSchemaV1,
  ParamSchema extends StandardSchemaV1 = StandardSchemaV1,
  HeaderSchema extends StandardSchemaV1 = StandardSchemaV1,
  CookieSchema extends StandardSchemaV1 = StandardSchemaV1,
> = {
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  query?: QuerySchema
  body?: JsonSchema
  form?: FormSchema
  params?: ParamSchema
  headers?: HeaderSchema
  cookies?: CookieSchema
  responses: ResponseObject<T>
}

type Num<T> = T extends `${infer N extends number}` ? N : T

type PromiseOr<T> = T | Promise<T>

type HandlerResponse<
  T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<
    Record<StatusCode, StandardSchemaV1>
  >,
> = {
  [K in keyof T]: T[K] extends StandardSchemaV1
    ? PromiseOr<
        TypedResponse<
          StandardSchemaV1.InferOutput<T[K]>,
          Num<K> extends StatusCode ? Num<K> : never
        >
      >
    : never
}[keyof T]

export type Handler<
  E extends Env,
  P extends string,
  I extends Input,
  T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<
    Record<StatusCode, StandardSchemaV1>
  >,
> = (c: Context<E, P, I>, next: Next) => HandlerResponse<T>

export type HasUndefined<T> = undefined extends T ? true : false

export type InferInOut<S extends StandardSchemaV1> = {
  in: StandardSchemaV1.InferInput<S>
  out: StandardSchemaV1.InferOutput<S>
}

export type WithRouteSpec = <
  E extends Env,
  P extends string,
  T extends Partial<Record<StatusCode, StandardSchemaV1>>,
  JsonSchema extends StandardSchemaV1,
  FormSchema extends StandardSchemaV1,
  QuerySchema extends StandardSchemaV1,
  ParamSchema extends StandardSchemaV1,
  HeaderSchema extends StandardSchemaV1,
  CookieSchema extends StandardSchemaV1,
  Target extends keyof ValidationTargets,
  IO extends {
    json: InferInOut<JsonSchema>
    form: InferInOut<FormSchema>
    query: InferInOut<QuerySchema>
    param: InferInOut<ParamSchema>
    header: InferInOut<HeaderSchema>
    cookie: InferInOut<CookieSchema>
  } = {
    json: InferInOut<JsonSchema>
    form: InferInOut<FormSchema>
    query: InferInOut<QuerySchema>
    param: InferInOut<ParamSchema>
    header: InferInOut<HeaderSchema>
    cookie: InferInOut<CookieSchema>
  },
  I extends Input = HasUndefined<
    IO["json"]["in"] &
      IO["form"]["in"] &
      IO["query"]["in"] &
      IO["param"]["in"] &
      IO["header"]["in"] &
      IO["cookie"]["in"]
  > extends true
    ? Input
    : {
        in: { [K in Target]: IO[K]["in"] }
        out: { [K in Target]: IO[K]["out"] }
      },
>(
  schema: Schema<
    T,
    JsonSchema,
    FormSchema,
    QuerySchema,
    ParamSchema,
    HeaderSchema,
    CookieSchema
  >,
  handler: Handler<E, P, I, T>
) => MiddlewareHandler<E, P, I>[]

export type { StatusCode } from "hono/utils/http-status"
