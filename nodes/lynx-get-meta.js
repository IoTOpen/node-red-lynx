'use strict'

module.exports = function (RED) {
    const lynx = require('@iotopen/node-lynx')

    function LynxGetMetaNode(config) {
        RED.nodes.createNode(this, config)
        const node = this
        this.use_msg = config.use_msg

        if (!this.use_msg) {
            this.server = RED.nodes.getNode(config.server)
            this.installation_id = config.installation_id
            this.client_id = config.client_id
            this.function_id = config.function_id
        }

        if (!this.server && !this.use_msg) {
            return this.error(RED._('_lynx.errors.missing-config'))
        }

        this.on('input', (msg, send, done) => {
            if (this.use_msg) {
                if (msg.installation_id && msg.function_id && msg.lynx_server) {
                    node.installation_id = msg.installation_id
                    node.function_id = msg.function_id
                    node.server = RED.nodes.getNode(msg.lynx_server)
                } else {
                    this.error(RED._('_lynx.errors.missing-config-in-msg'))
                    if (done) return done()
                }
            }

            this.status({
                fill: 'blue',
                shape: 'dot',
                text: 'fetching'
            })

            const cli = new lynx.LynxClient(node.server.url, node.server.api_key)

            cli.getFunction(node.installation_id, node.function_id).then(json => {
                if (json.meta) {
                    msg.meta = json.meta
                    msg.installation_id = this.installation_id
                    msg.client_id = this.client_id
                    msg.function_id = this.function_id
                    msg.lynx_server = this.server.id
                    send(msg)

                    this.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'success'
                    })
                }

                if (done) done()
            }).catch((e) => {
                this.status({
                    fill: 'red',
                    shape: 'dot',
                    text: 'node-red:common.status.error'
                })

                if (done) done(e)
            })
        })
    }

    RED.nodes.registerType('lynx-get-meta', LynxGetMetaNode)
}
