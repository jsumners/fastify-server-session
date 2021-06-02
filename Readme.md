# fastify-server-session

This is a plugin for [Fastify](https://fastify.io/) that facilitates keep state
for clients between requests via server-side storage.

**Requirements:**

+ [fastify-cookie](https://www.npmjs.com/package/fastify-cookie): used to set
a cookie for tracking sessions.
+ [fastify-caching](https://www.npmjs.com/package/fastify-caching): used to
store the session data via the `fastify.cache` decorator.


**Installation:**

```
npm install fastify-server-session fastify-cookie fastify-caching
```

## Example

### Server Side Storage

Using this implementation the sessions will be stored in memory on the Fastify instance
making the server stateful. This is not recommended for production. It will not share
state among multiple instances of the same application.

```js
const fastify = require('fastify')()
fastify
  .register(require('fastify-cookie'))
  .register(require('fastify-caching'))
  .register(require('fastify-server-session'), {
    secretKey: 'some-secret-password-at-least-32-characters-long',
    sessionMaxAge: 900000, // 15 minutes in milliseconds
    cookie: {
      domain: '.example.com',
      path: '/'
    }
  })

fastify.get('/one', (req, reply) => {
  req.session.foo = 'foo'
  reply.send()
})

fastify.get('/two', (req, reply) => {
  reply.send({foo: req.session.foo})
})
```

### Remote Cache Store

`fastify-caching` offers the connectivity to a remote store as shown below with `ioredis` and `abstract-cache`.
See `fastify-caching` [documentation](https://github.com/fastify/fastify-caching) for other
storage capabilities.

```js
// This example requires the following packages to be installed
// - ioredis
// - abstract-cache

const IORedis = require('ioredis')
const redis = new IORedis({host: '127.0.0.1'})
const abcache = require('abstract-cache')({
  useAwait: true,
  driver: {
    name: 'abstract-cache-redis',
    options: {client: redis}
  }
})
const fastify = require('fastify')()
fastify
  .register(require('fastify-cookie'))
  .register(require('fastify-caching'), {cache: abcache})
  .register(require('fastify-server-session'), {
    secretKey: 'some-secret-password-at-least-32-characters-long',
    sessionMaxAge: 900000, // 15 minutes in milliseconds
    cookie: {
      domain: '.example.com',
      path: '/'
    }
  })

fastify.get('/one', (req, reply) => {
  req.session.foo = 'foo'
  reply.send()
})

fastify.get('/two', (req, reply) => {
  reply.send({foo: req.session.foo})
})
```

**Note:** In the previous example the `sessionMaxAge` value will set the Redis TTL of the session key.

## Options

The plugin accepts an options object with the following properties:

+ `secretKey` (Default: `undefined`): this is a **required** property that must
be a string with a minimum of 32 characters.
+ `sessionCookieName` (Default: `sessionid`): a string to name the cookie sent
to the client to track the session.
+ `sessionMaxAge` (Default: `1800000`): a duration in milliseconds for which
the sessions will be valid.
+ `cookie`: an options as described in the [cookie module's documentation][cookiedoc].
The default value is:
    * `domain`: `undefined`
    * `expires`: same as `sessionMaxAge`
    * `httpOnly`: `true`
    * `path`: `undefined`
    * `sameSite`: `true`

[cookiedoc]: https://www.npmjs.com/package/cookie#options-1

## TypeScript

To use type checking on session object you can use the declaration:

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    session: {
      foo: string;
      bar: number;
    };
  }
}
```

## License

[MIT License](http://jsumners.mit-license.org/)
