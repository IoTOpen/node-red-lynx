'use strict'

const watchFunctions = require('./function-watch')

module.exports = function (RED) {
  function LynxOutNode (config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.server = RED.nodes.getNode(config.server)
    this.topic = config.topic
    this.topic_type = config.topic_type
    this.client_id = config.client_id
    this.installation_id = config.installation_id
    this.function_id = config.function_id

    if (!this.server) {
      return this.error(RED._('lynx.errors.missing-config'))
    }

    this.status({
      fill: 'red',
      shape: 'dot',
      text: 'node-red:common.status.disconnected'
    })

    let currentTopic = this.topic
    // The meta key (e.g. "topic_write") the configured topic came from.
    // Known directly for nodes saved after this field was added; for
    // older configs we fall back to guessing it by matching the value,
    // which is ambiguous if two topic_* keys share the same value.
    let topicMetaKey = this.topic_type || null

    const updateStaticTopic = (list) => {
      const fn = list.find((f) => String(f.id) === String(node.function_id))
      if (!fn || !fn.meta) return

      if (!topicMetaKey) {
        topicMetaKey = Object.keys(fn.meta).find((k) => k.startsWith('topic_') && fn.meta[k] === currentTopic)
      }
      if (!topicMetaKey) return

      const newTopic = fn.meta[topicMetaKey]
      if (!newTopic || newTopic === currentTopic) return

      currentTopic = newTopic
    }

    this.on('input', (msg, send, done) => {
      msg.payload = convertPayload(msg.payload)
      msg.topic = this.client_id + '/' + currentTopic

      this.server.publish(msg, done)
    })

    if (this.server.connected) {
      this.status({
        fill: 'green',
        shape: 'dot',
        text: 'node-red:common.status.connected'
      })
    }

    node.server.register(node)
    const watcher = watchFunctions(RED, node, node.server, {
      clientId: this.client_id,
      installationId: this.installation_id,
      functionId: this.function_id,
      onUpdate: updateStaticTopic
    })

    this.on('close', (done) => {
      watcher.close()
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
