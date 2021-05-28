'use strict'

module.exports = function (RED) {
  function LynxInNode (config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.server = RED.nodes.getNode(config.server)
    this.topic = config.topic
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

    const fullTopic = this.client_id + '/' + this.topic
    node.server.register(this)

    node.server.subscribe(fullTopic, 0, (topic, payload, packet) => {
      payload = payload.toString()

      try {
        payload = JSON.parse(payload)
      } catch (e) {
        return node.error(RED._('lynx.errors.invalid-json-parse'), { payload, topic, qos: packet.qos, retain: packet.retain })
      }

      const out = {
        payload,
        topic,
        function_id: this.function_id,
        installation_id: this.installation_id,
        lynx_server: config.server
      }

      node.send(out)
    }, this.id)

    if (this.server.connected) {
      this.status({
        fill: 'green',
        shape: 'dot',
        text: 'node-red:common.status.connected'
      })
    }

    this.on('close', (removed, done) => {
      if (node.server) {
        node.server.unsubscribe(fullTopic, node.id, removed)
        node.server.deregister(node, done)
      }
    })
  }

  RED.nodes.registerType('lynx-in', LynxInNode)
}
