'use strict'

module.exports = function (RED) {
  function LynxOutNode (config) {
    RED.nodes.createNode(this, config)
    const node = this
    const server = RED.nodes.getNode(config.server)

    const topic = config.topic
    const clientId = config.client_id
    const installationId = config.installation_id
    const functionId = config.function_id
    const qos = config.qos || 0

    if (!server) {
      return node.error(RED._('lynx.errors.missing-config'))
    }

    server.register(config.id, node)

    this.on('close', (removed, done) => {
      if (!server) return

      server.unsubscribe(fullTopic)
      server.offMessage(config.id, fullTopic)
      server.deregister(config.id, done)
    })

    const fullTopic = clientId + '/' + topic

    server.subscribe(fullTopic, { qos }, (err) => {
      if (err) return node.send(err)

      server.onMessage(config.id, fullTopic, (topic, payload, packet) => {
        payload = payload.toString()

        try {
          payload = JSON.parse(payload)
        } catch (e) {
          return node.error(RED._('lynx.errors.invalid-json-parse'), { payload, topic, qos: packet.qos, retain: packet.retain })
        }

        const out = {
          payload,
          topic,
          function_id: functionId,
          installation_id: installationId,
          lynx_server: server
        }

        node.send(out)
      })
    })
  }

  RED.nodes.registerType('lynx-in', LynxOutNode)
}
