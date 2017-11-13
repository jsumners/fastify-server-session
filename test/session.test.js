'use strict'

const test = require('tap').test
const request = require('request')
const cookie = require('cookie')
const fastify = require('fastify')
const fastifyCaching = require('fastify-caching')
const fastifyCookie = require('fastify-cookie')
const plugin = require('../')
const secretKey = '12345678901234567890123456789012'

test('rejects if no secretKey supplied', (t) => {
  t.plan(1)
  const server = fastify()
  t.throws(server.register.bind(plugin))
})

test('rejects if secretKey is too short', (t) => {
  t.plan(1)
  const server = fastify()
  t.throws(server.register.bind(plugin, {secretKey: '123456'}))
})

test('rejects if cookie expiration is not an integer', (t) => {
  t.plan(1)
  const server = fastify()
  server.register(fastifyCookie).register(fastifyCaching)
  t.throws(server.register.bind(plugin, {secretKey, cookie: {expires: 'foo'}}))
})

test('registers with all dependencies met', (t) => {
  t.plan(1)
  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, {secretKey}, (err) => {
      if (err) t.threw(err)
      t.pass()
    })
})

test('decorates server with session object', (t) => {
  t.plan(2)
  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, {secretKey})

  server.get('/', (req, reply) => {
    t.ok(req.session)
    t.deepEqual(req.session, {})
    reply.send()
  })

  server.listen(0, (err) => {
    server.server.unref()
    if (err) t.threw(err)
    request.get(`http://127.0.0.1:${server.server.address().port}/`, (err, res, body) => {
      if (err) t.threw(err)
    })
  })
})

test('sets cookie name', (t) => {
  t.plan(2)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, {secretKey, sessionCookieName: 'foo-session'})

  server.get('/', (req, reply) => reply.send())

  server.listen(0, (err) => {
    server.server.unref()
    if (err) t.threw(err)
    request.get(`http://127.0.0.1:${server.server.address().port}/`, (err, res, body) => {
      if (err) t.threw(err)
      t.ok(res.headers['set-cookie'])
      t.match(res.headers['set-cookie'], /foo-session/)
    })
  })
})

test('sets cookie expiration', (t) => {
  t.plan(1)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, {secretKey, cookie: {expires: 60000}})

  server.get('/', (req, reply) => reply.send())

  server.listen(0, (err) => {
    server.server.unref()
    if (err) t.threw(err)
    request.get(`http://127.0.0.1:${server.server.address().port}/`, (err, res, body) => {
      if (err) t.threw(err)
      const setCookie = cookie.parse(res.headers['set-cookie'][0])
      const future = new Date(Date.now() + 60000)
      const expiration = new Date(setCookie.Expires)
      t.ok(future > expiration)
    })
  })
})

test('set session data', (t) => {
  t.plan(4)

  const server = fastify()
  server
    .register(fastifyCookie)
    .register(fastifyCaching)
    .register(plugin, {secretKey})

  server.get('/one', (req, reply) => {
    req.session.one = true
    reply.send()
  })

  server.get('/two', (req, reply) => {
    t.ok(req.session)
    t.ok(req.session.one)
    reply.send()
  })

  server.listen(0, (err) => {
    server.server.unref()
    if (err) t.threw(err)

    const port = server.server.address().port
    const r = request.defaults({baseUrl: `http://127.0.0.1:${port}`, jar: true})

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
