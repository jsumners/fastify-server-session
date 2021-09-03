'use strict'

const test = require('tap').test
const request = require('request')
const fastify = require('fastify')
const fastifyCaching = require('fastify-caching')
const fastifyCookie = require('fastify-cookie')
const plugin = require('../')
const secretKey = '12345678901234567890123456789012'

test('can store sessions in a mongo database', (t) => {
  t.plan(3)

  const server = fastify()
  const cache = require('abstract-cache')({
    useAwait: false,
    driver: {
      name: 'abstract-cache-mongo',
      options: {
        dbName: 'testing',
        mongodb: {
          url: 'mongodb://localhost:27017/testing'
        }
      }
    }
  })

  t.teardown(() => {
    server.close()
    cache.stop(() => {})
  })

  cache.start((err) => {
    if (err) t.threw(err)
    runTests()
  })

  function runTests () {
    server
      .register(fastifyCookie)
      .register(fastifyCaching, { cache })
      .register(plugin, { secretKey })
      .after((err) => {
        if (err) t.threw(err)
      })

    server.get('/one', (req, reply) => {
      t.ok(req.session)
      t.strictSame(req.session, {})
      req.session.one = true
      reply.send()
    })

    server.get('/two', (req, reply) => {
      t.strictSame(req.session, {
        one: true
      })
      reply.send()
    })

    server.listen(0, (err) => {
      server.server.unref()
      if (err) t.threw(err)
      const port = server.server.address().port
      const address = `http://127.0.0.1:${port}`
      const jar = request.jar()
      request.get(`${address}/one`, { jar }, (err, res, body) => {
        if (err) t.threw(err)
        request.get(`${address}/two`, { jar }, (err, res, body) => {
          if (err) t.threw(err)
        })
      })
    })
  }
})

test('can store sessions in a mongo database useAwait:true', (t) => {
  t.plan(3)

  const server = fastify()
  const cache = require('abstract-cache')({
    useAwait: true,
    driver: {
      name: 'abstract-cache-mongo',
      options: {
        dbName: 'testing-await',
        mongodb: {
          url: 'mongodb://localhost:27017/testing-await'
        }
      }
    }
  })

  t.teardown(() => {
    server.close()
    cache.stop()
  })

  cache.start()
    .then(runTests)
    .catch(t.threw)

  function runTests () {
    server
      .register(fastifyCookie)
      .register(fastifyCaching, { cache })
      .register(plugin, { secretKey })
      .after((err) => {
        if (err) t.threw(err)
      })

    server.get('/one', (req, reply) => {
      t.ok(req.session)
      t.strictSame(req.session, {})
      req.session.one = true
      reply.send()
    })

    server.get('/two', (req, reply) => {
      t.strictSame(req.session, {
        one: true
      })
      reply.send()
    })

    server.listen(0, (err) => {
      server.server.unref()
      if (err) t.threw(err)
      const port = server.server.address().port
      const address = `http://127.0.0.1:${port}`
      const jar = request.jar()
      request.get(`${address}/one`, { jar }, (err, res, body) => {
        if (err) t.threw(err)
        request.get(`${address}/two`, { jar }, (err, res, body) => {
          if (err) t.threw(err)
        })
      })
    })
  }
})
