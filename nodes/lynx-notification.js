'use strict'

const lynx = require('@iotopen/node-lynx')


module.exports = function (RED) {
  function LynxNotification (config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.server = RED.nodes.getNode(config.server)
    this.installationId = config.installation_id
    this.outputId = config.output_id
    if (!this.server) {
      return this.error(RED._('lynx.errors.missing-config'))
    }

    this.on('input', (msg, send, done) => {
      this.status({
        fill: 'blue',
        shape: 'dot',
        text: 'fetching'
     })
      const cli = new lynx.LynxClient(node.server.url, node.server.api_key)
      node.warn('installationID: ' + this.installationId + ' outputID: ' + this.outputId )
      cli.sendNotification(this.installationId, this.outputId, msg).then(json => {
        this.status({
          fill: 'green',
          shape: 'dot',
          text: 'success'
        })
        if (done) done()
      }).catch((e) => {
        this.status({
          fill: 'red',
          shape: 'dot',
          text: 'node-red:common.status.error'
        })
        node.log(RED._('lynx.error', e))
        if (done) done(e)
      })
    })
  }
  RED.nodes.registerType('lynx-notification', LynxNotification)
}