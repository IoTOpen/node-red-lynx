'use strict'

// Shared helper for nodes that depend on a Lynx function (or the set of
// functions on an installation) staying in sync with the backend.
//
// It uses the lynx-server node's shared function cache (see lynx-server.js)
// so multiple nodes on the same installation don't each fetch their own
// copy, and it listens for the `<client_id>/evt/functionx/updated` event to
// refresh that cache and react to changes (e.g. a function being deleted).
module.exports = function watchFunctions (RED, node, server, options) {
  const clientId = options.clientId
  const installationId = options.installationId
  const functionId = options.functionId
  const onUpdate = options.onUpdate

  const updateTopic = clientId + '/evt/functionx/updated'
  let closed = false

  const checkFunctionExists = (list) => {
    if (functionId === undefined || functionId === null || functionId === '') return
    const found = list.some((fn) => String(fn.id) === String(functionId))
    if (!found) {
      node.status({
        fill: 'yellow',
        shape: 'ring',
        text: RED._('lynx.warnings.function-deleted')
      })
    }
  }

  const refresh = (force) => {
    server.getFunctions(installationId, force).then((list) => {
      if (closed) return
      checkFunctionExists(list)
      if (onUpdate) onUpdate(list)
    }).catch((e) => {
      if (!closed) node.error(e)
    })
  }

  server.subscribe(updateTopic, 0, () => refresh(true), node.id)
  refresh(false)

  return {
    refresh,
    close: () => {
      closed = true
      server.unsubscribe(updateTopic, node.id, true)
    }
  }
}
