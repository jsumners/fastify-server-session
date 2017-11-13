# fastify-server-session

This is a plugin for [Fastify](https://fastify.io/) that facilitates keep state
for clients between requests via server-side storage.

**Requirements:**

+ [fastify-cookie](https://www.npmjs.com/package/fastify-cookie): used to set
a cookie for tracking sessions.
+ [fastify-caching](https://www.npmjs.com/package/fastify-caching): used to
store the session data via the `fastify.cache` decorator.

## Example

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
  res.session.foo = 'foo'
  reply.send()
})

fastify.get('/two', (req, reply) => {
  reply.send({foo: req.session.foo})
})
```

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

## License

[MIT License](http://jsumners.mit-license.org/)
