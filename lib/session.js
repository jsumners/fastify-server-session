'use strict'

const syms = {
  kSessionModified: Symbol('fastify-servier-session.sessionModified')
}

module.exports = function getSession (fromObject) {
  let session
  if (fromObject) {
    session = fromObject
    session[syms.kSessionModified] = false
  } else {
    session = {
      get [Symbol.toStringTag] () { return 'fastify-server-session.session-object' },
      [syms.kSessionModified]: false
    }
  }
  const proxy = new Proxy(session, {
    set (target, prop, value, receiver) {
      if (target[syms.kSessionModified] === false) {
        target[syms.kSessionModified] = true
      }
      target[prop] = value
      return receiver
    }
  })
  return proxy
}

module.exports.symbols = syms
