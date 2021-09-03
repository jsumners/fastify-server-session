'use strict'

const fp = require('fastify-plugin')
const { sign, unsign } = require('cookie-signature')
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
const getSession = require('./lib/session')
const { symbols: syms } = getSession

function plugin (fastify, options, pluginRegistrationDone) {
  // eslint-disable-next-line
  const _options = Function.prototype.isPrototypeOf(options) ? {} : options
  const opts = merge({}, defaultOptions, _options)
  if (!opts.secretKey) {
    return pluginRegistrationDone(Error('must supply secretKey'))
  }
  // https://security.stackexchange.com/a/96176/38214
  if (opts.secretKey.length < 32) {
    return pluginRegistrationDone(
      Error('secretKey must be at least 32 characters')
    )
  }
  if (opts.cookie.expires && !Number.isInteger(opts.cookie.expires)) {
    return pluginRegistrationDone(
      Error('cookie expires time must be a value in milliseconds')
    )
  }

  fastify.decorateRequest('session', null)
  fastify.addHook('onRequest', function (req, reply, hookFinished) {
    function getHandler (cached) {
      if (!cached) {
        req.log.trace('session data missing (new/expired)')
        return hookFinished()
      }
      req.session = getSession(cached.item)
      req.log.trace('session restored: %j', req.session)
      hookFinished()
    }

    function getErrorHandler (err) {
      req.log.trace('could not retrieve session data')
      hookFinished(err)
    }

    req.session = getSession()
    if (!req.cookies[opts.sessionCookieName]) {
      return hookFinished()
    }

    const sessionId = unsign(
      req.cookies[opts.sessionCookieName],
      opts.secretKey
    )
    req.log.trace('sessionId: %s', sessionId)
    if (sessionId === false) {
      req.log.warn('session id signature mismatch, starting new session')
      return hookFinished()
    }

    if (this.cache.await) {
      this.cache.get(sessionId)
        .then(getHandler)
        .catch(getErrorHandler)
    } else {
      this.cache.get(sessionId, (err, cached) => {
        if (err) {
          getErrorHandler(err)
        } else {
          getHandler(cached)
        }
      })
    }
  })

  fastify.addHook('onSend', function (req, reply, payload, hookFinished) {
    if (req.session[syms.kSessionModified] === false) {
      return hookFinished()
    }

    if (req.cookies[opts.sessionCookieName]) {
      const id = unsign(req.cookies[opts.sessionCookieName], opts.secretKey)
      return storeSession.call(this, null, id)
    }

    uidgen(18, storeSession.bind(this))

    function storeSession (err, sessionId) {
      function cacheSetHandler () {
        const cookieExiresMs = opts.cookie && opts.cookie.expires
        const cookieOpts = merge({}, opts.cookie, {
          expires: !cookieExiresMs
            ? undefined
            : new Date(Date.now() + cookieExiresMs)
        })
        const signedId = sign(sessionId, opts.secretKey)
        reply.setCookie(opts.sessionCookieName, signedId, cookieOpts)
        hookFinished()
      }

      function cacheErrorHandler () {
        req.log.trace('error saving session: %s', err.message)
        return hookFinished(err)
      }

      if (err) {
        req.log.trace('could not store session with invalid id')
        return hookFinished(err)
      }

      if (!sessionId) {
        req.log.trace('could not store session with missing id')
        return hookFinished(Error('missing session id'))
      }
      if (this.cache.await) {
        this.cache.set(sessionId, req.session, opts.sessionMaxAge)
          .then(cacheSetHandler)
          .catch(cacheErrorHandler)
      } else {
        this.cache.set(sessionId, req.session, opts.sessionMaxAge, err => {
          if (err) {
            cacheErrorHandler(err)
          } else {
            cacheSetHandler()
          }
        })
      }
    }
  })

  pluginRegistrationDone()
}

module.exports = fp(plugin, {
  fastify: '^3.0.0',
  dependencies: ['fastify-cookie'],
  decorators: {
    fastify: ['cache']
  }
})
