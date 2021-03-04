'use strict'

module.exports = function (RED) {
  function LynxInNode (config) {
    RED.nodes.createNode(this, config)
    const node = this
    const server = RED.nodes.getNode(config.server)

    const topic = config.topic
    const clientId = config.client_id

    if (!server) {
      return node.error(RED._('lynx.errors.missing-config'))
    }

    server.register(config.id, node)

    node.on('close', (done) => {
      server.deregister(config.id, done)
    })

    node.on('input', (msg, send, done) => {
      msg.payload = convertPayload(msg.payload)
      msg.topic = clientId + '/' + topic
      server.publish(msg, done)
    })
  }

  RED.nodes.registerType('lynx-out', LynxInNode)
}

function convertPayload (incoming) {
  const msg = {
    timestamp: Date.now() / 1000
  }

  if (typeof incoming === 'object') {
    if (typeof incoming.msg === 'string') {
      msg.msg = incoming.msg
    }

    if (typeof incoming.value === 'number') {
      msg.value = incoming.value
    }

    if (typeof incoming.timestamp === 'number') {
      msg.timestamp = incoming.timestamp
    }
  } else if (typeof incoming === 'number') {
    msg.value = incoming
  }

  return msg
}
