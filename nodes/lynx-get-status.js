'use strict'

module.exports = function (RED) {
    const lynx = require('@iotopen/node-lynx')

    function LynxGetStatusNode(config) {
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

        this.on('input', (msg, send, done) => {
            this.status({
                fill: 'blue',
                shape: 'dot',
                text: 'fetching'
            })

            const cli = new lynx.LynxClient(node.server.url, node.server.api_key)
            cli.getStatus(node.installation_id, [node.topic]).then(statuses => {
                if (statuses.length === 0) {
                    this.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'no result'
                    })
                    if (done) done()
                    return
                }
                this.status({
                    fill: 'green',
                    shape: 'dot',
                    text: 'success'
                })
                let status = statuses[0];
                msg.original_payload = msg.payload;
                msg.payload = {
                    value: status.value,
                    timestamp: status.timestamp,
                    msg: status.msg
                }
                msg.installation_id = this.installation_id;
                msg.client_id = this.client_id;
                msg.function_id = this.function_id;
                msg.lynx_server = this.server.id;

                send(msg)
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

    RED.nodes.registerType('lynx-get-status', LynxGetStatusNode)
}
