'use strict'

const { test } = require('tap')
const getSession = require('../../lib/session')
const { symbols: syms } = getSession

test('returns a session object that is unmodified', t => {
  t.plan(1)
  const session = getSession()
  t.equal(session[syms.kSessionModified], false)
})

test('detects when session is modified', t => {
  t.plan(2)
  const session = getSession()
  session.foo = 'foo'
  t.equal(session.foo, 'foo')
  t.equal(session[syms.kSessionModified], true)
})

test('returns existing unmodified session from existing object', t => {
  t.plan(2)
  const session = getSession({ foo: 'foo' })
  t.equal(session.foo, 'foo')
  t.equal(session[syms.kSessionModified], false)
})

test('detects modification of session from existing object', t => {
  t.plan(2)
  const session = getSession({ foo: 'foo' })
  t.equal(session.foo, 'foo')

  session.bar = 'bar'
  t.equal(session[syms.kSessionModified], true)
})
