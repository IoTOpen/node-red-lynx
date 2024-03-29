'use strict'

module.exports = function (RED) {
  function LynxOutNode (config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.server = RED.nodes.getNode(config.server)
    this.topic = config.topic
    this.client_id = config.client_id

    if (!this.server) {
      return this.error(RED._('lynx.errors.missing-config'))
    }

    this.status({
      fill: 'red',
      shape: 'dot',
      text: 'node-red:common.status.disconnected'
    })

    this.on('input', (msg, send, done) => {
      msg.payload = convertPayload(msg.payload)
      msg.topic = this.client_id + '/' + this.topic

      this.server.publish(msg, done)
    });

    if (this.server.connected) {
      this.status({
        fill: 'green',
        shape: 'dot',
        text: 'node-red:common.status.connected'
      })
    }

    node.server.register(node)

    this.on('close', (done) => {
      node.server.deregister(node, done)
    })
  }

  RED.nodes.registerType('lynx-out', LynxOutNode)
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
