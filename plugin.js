'use strict'

const fp = require('fastify-plugin')
const {sign, unsign} = require('cookie-signature')
const uidgen = require('uid-safe')
const merge = require('merge-options')
const MAX_AGE = 1800000 // 30 minutes
const defaultOptions = {
  cookie: {
    domain: undefined,
    expires: MAX_AGE,
    httpOnly: true,
    path: undefined,
    sameSite: true
  },
  secretKey: undefined,
  sessionCookieName: 'sessionid',
  sessionMaxAge: MAX_AGE
}

function plugin (fastify, options, next) {
  const _options = (Function.prototype.isPrototypeOf(options)) ? {} : options
  const opts = merge({}, defaultOptions, _options)
  if (!opts.secretKey) return next(Error('must supply secretKey'))
  // https://security.stackexchange.com/a/96176/38214
  if (opts.secretKey.length < 32) return next(Error('secretKey must be at least 32 characters'))
  if (opts.cookie.expires && !Number.isInteger(opts.cookie.expires)) {
    return next(Error('cookie expires time must be a value in milliseconds'))
  }

  fastify.decorateRequest('session', {})

  // I really think this should be an onRequest, but that hook doesn't
  // have Fastify objects passed in. ~ jsumners
  fastify.addHook('preHandler', function (req, reply, next) {
    if (!req.cookies[opts.sessionCookieName]) {
      req.session = {}
      return next()
    }

    const sessionId = unsign(req.cookies[opts.sessionCookieName], opts.secretKey)
    req.log.trace('sessionId: %s', sessionId)
    if (sessionId === false) {
      req.log.warn('session id signature mismatch')
      req.session = {}
      return next()
    }

    this.cache.get(sessionId, (err, cached) => {
      if (err) {
        req.log.trace('could not retrieve session data')
        return next(err)
      }
      if (!cached) {
        req.log.trace('session data missing (new/expired)')
        req.session = {}
        return next()
      }
      req.log.trace('session restored: %j', req.session)
      req.session = cached.item
      next()
    })
  })

  fastify.addHook('onSend', function (req, reply, payload, next) {
    const storeSession = (err, sessionId) => {
      if (err) {
        req.log.trace('could not store session with invalid id')
        return next(err)
      }

      if (!sessionId) {
        req.log.trace('could not store session with missing id')
        return next(Error('missing session id'))
      }

      this.cache.set(sessionId, req.session, opts.sessionMaxAge, (err) => {
        if (err) {
          req.log.trace('error saving session: %s', err.message)
          return next(err)
        }
        const cookieExiresMs = opts.cookie && opts.cookie.expires
        const cookieOpts = merge({}, opts.cookie, {
          expires: (!cookieExiresMs)
            ? undefined
            : new Date(Date.now() + cookieExiresMs)
        })
        const signedId = sign(sessionId, opts.secretKey)
        reply.setCookie(opts.sessionCookieName, signedId, cookieOpts)
        next()
      })
    }

    if (req.cookies[opts.sessionCookieName]) {
      const id = unsign(req.cookies[opts.sessionCookieName], opts.secretKey)
      return storeSession(null, id)
    }
    uidgen(18, storeSession)
  })

  next()
}

module.exports = fp(plugin, {
  fastify: '>=1.0.0-rc.1',
  dependencies: ['fastify-cookie'],
  decorators: {
    fastify: ['cache']
  }
})
