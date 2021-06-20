'use strict'

const test = require('tap').test
const request = require('request')
const cookie = require('cookie')
const fastify = require('fastify')
const fastifyCaching = require('fastify-caching')
const fastifyCookie = require('fastify-cookie')
const plugin = require('../')
const secretKey = '12345678901234567890123456789012'

test('rejects if no secretKey supplied', t => {
  t.plan(1)
  const server = fastify()
  t.throws(server.register.bind(plugin))
})

test('rejects if secretKey is too short', t => {
  t.plan(1)
  const server = fastify()
  t.throws(server.register.bind(plugin, { secretKey: '123456' }))
})

test('rejects if cookie expiration is not an integer', t => {
  t.plan(1)
  const server = fastify()
  server.register(fastifyCookie).register(fastifyCaching)
  t.throws(
    server.register.bind(plugin, { secretKey, cookie: { expires: 'foo' } })
  )
})

test('registers with all dependencies met', t => {
  t.plan(1)
  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, { secretKey })
    .after(err => {
      if (err) t.threw(err)
      t.pass()
    })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)
  })

  t.teardown(() => server.close().catch(() => {}))
})

test('decorates server with session object', t => {
  t.plan(2)
  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, { secretKey })

  server.get('/', (req, reply) => {
    t.ok(req.session)
    t.strictSame(req.session, {})
    reply.send()
  })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)
    request.get(
      `http://127.0.0.1:${server.server.address().port}/`,
      (err, res, body) => {
        if (err) t.threw(err)
      }
    )
  })
})

test('sets cookie name', t => {
  t.plan(2)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, { secretKey, sessionCookieName: 'foo-session' })

  server.get('/', (req, reply) => {
    req.session.touched = true
    reply.send()
  })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)
    request.get(
      `http://127.0.0.1:${server.server.address().port}/`,
      (err, res, body) => {
        if (err) t.threw(err)
        t.ok(res.headers['set-cookie'])
        t.match(res.headers['set-cookie'], /foo-session/)
      }
    )
  })
})

test('sets cookie expiration', t => {
  t.plan(1)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, { secretKey, cookie: { expires: 60000 } })

  server.get('/', (req, reply) => {
    req.session.touched = true
    reply.send()
  })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)
    request.get(
      `http://127.0.0.1:${server.server.address().port}/`,
      (err, res, body) => {
        if (err) t.threw(err)
        const setCookie = cookie.parse(res.headers['set-cookie'][0])
        const future = new Date(Date.now() + 60000)
        const expiration = new Date(setCookie.Expires)
        t.ok(future > expiration)
      }
    )
  })
})

test('set session data', t => {
  t.plan(4)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, { secretKey })

  server.get('/one', (req, reply) => {
    req.session.one = true
    reply.send()
  })

  server.get('/two', (req, reply) => {
    t.ok(req.session)
    t.ok(req.session.one)
    reply.send()
  })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)

    const port = server.server.address().port
    const r = request.defaults({
      baseUrl: `http://127.0.0.1:${port}`,
      jar: request.jar()
    })

    r.get('/one', (err, res, body) => {
      if (err) t.threw(err)
      t.ok(res.headers['set-cookie'])
      t.match(res.headers['set-cookie'], /sessionid/)

      r.get('/two', (err, res, body) => {
        if (err) t.threw(err)
      })
    })
  })
})

test('separate clients do not share a session', { only: true }, t => {
  t.plan(8)
  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, {
      secretKey,
      cookie: {
        domain: '127.0.0.1',
        path: '/'
      }
    })

  server.get('/one/:clientid', (req, reply) => {
    t.notOk(req.session.client)
    req.session.client = req.params.clientid
    reply.send()
  })

  server.get('/two/:clientid', (req, reply) => {
    t.ok(req.session.client)
    t.equal(req.session.client, req.params.clientid)
    reply.send()
  })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)

    const port = server.server.address().port
    const jar1 = request.jar()
    const jar2 = request.jar()
    const r = request.defaults({ baseUrl: `http://127.0.0.1:${port}` })

    r.get({ url: '/one/foo', jar: jar1 }, (err, res, body) => {
      if (err) t.threw(err)

      r.get({ url: '/one/bar', jar: jar2 }, (err, res, body) => {
        if (err) t.threw(err)

        r.get({ url: '/two/foo', jar: jar1 }, (err, res, body) => {
          t.error(err)
        })
        r.get({ url: '/two/bar', jar: jar2 }, (err, res, body) => {
          t.error(err)
        })
      })
    })
  })
})

test('no cookie is sent when new session is not changed', t => {
  t.plan(1)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, { secretKey })

  server.get('/notcreate', (req, reply) => {
    reply.send()
  })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)

    const port = server.server.address().port
    const r = request.defaults({
      baseUrl: `http://127.0.0.1:${port}`,
      jar: false
    })
    r.get('/notcreate', (err, res, body) => {
      if (err) t.threw(err)
      t.notOk(res.headers['set-cookie'])
    })
  })
})

test('issue #7: modify existing session', t => {
  t.plan(2)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, {
      secretKey,
      cookie: {
        domain: '127.0.0.1',
        path: '/'
      }
    })

  server.get('/one', (req, reply) => {
    req.session.foo = 'foo'
    reply.send({ hello: 'world' })
  })

  server.get('/two', (req, reply) => {
    req.session.bar = 'bar'
    reply.send({ session: req.session })
  })

  server.listen(0, err => {
    server.server.unref()
    if (err) t.threw(err)

    const port = server.server.address().port
    const r = request.defaults({
      baseUrl: `http://127.0.0.1:${port}`,
      jar: request.jar()
    })

    r.get('/one', (err, res, body) => {
      if (err) t.threw(err)
      t.strictSame(JSON.parse(body), { hello: 'world' })
      r.get('/two', (err, res, body) => {
        if (err) t.threw(err)
        t.strictSame(JSON.parse(body), { session: { foo: 'foo', bar: 'bar' } })
      })
    })
  })
})
