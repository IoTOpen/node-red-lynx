'use strict'

const watchFunctions = require('./function-watch')

module.exports = function (RED) {
    const lynx = require('@iotopen/node-lynx')

    function LynxGetStatusNode(config) {
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

        let currentTopic = this.topic;
        // The meta key (e.g. "topic_read") the configured topic came from.
        // Known directly for nodes saved after this field was added; for
        // older configs we fall back to guessing it by matching the value,
        // which is ambiguous if two topic_* keys share the same value.
        let topicMetaKey = this.topic_type || null;

        const updateStaticTopic = (list) => {
            const fn = list.find((f) => String(f.id) === String(node.function_id));
            if (!fn || !fn.meta) return;

            if (!topicMetaKey) {
                topicMetaKey = Object.keys(fn.meta).find((k) => k.startsWith('topic_') && fn.meta[k] === currentTopic);
            }
            if (!topicMetaKey) return;

            const newTopic = fn.meta[topicMetaKey];
            if (!newTopic || newTopic === currentTopic) return;

            currentTopic = newTopic;
        };

        node.server.register(this)
        const watcher = watchFunctions(RED, node, node.server, {
            clientId: this.client_id,
            installationId: this.installation_id,
            functionId: this.function_id,
            onUpdate: updateStaticTopic
        });

        this.on('close', (done) => {
            watcher.close();
            node.server.deregister(node, done);
        });

        this.on('input', (msg, send, done) => {
            this.status({
                fill: 'blue',
                shape: 'dot',
                text: 'fetching'
            })

            const cli = new lynx.LynxClient(node.server.url, node.server.api_key)
            cli.getStatus(node.installation_id, [currentTopic]).then(statuses => {
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
