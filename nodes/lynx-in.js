'use strict'

const lynx = require("@iotopen/node-lynx");
module.exports = function (RED) {
    function LynxInNode(config) {
        RED.nodes.createNode(this, config)
        const node = this
        this.server = RED.nodes.getNode(config.server)
        this.use_meta_filter = config.use_meta_filter;
        this.topic = config.topic
        this.client_id = config.client_id
        this.installation_id = config.installation_id
        this.function_id = config.function_id
        this.filter = config.filter;

        let functions = [];

        if (!this.server) {
            return this.error(RED._('lynx.errors.missing-config'))
        }

        this.status({
            fill: 'red',
            shape: 'dot',
            text: 'node-red:common.status.disconnected'
        })

        const setupFunctions = () => {
            const baseURL = node.server.url;
            const apiKey = node.server.api_key;
            const installationId = this.installation_id;
            const cli = new lynx.LynxClient(baseURL, apiKey);
            let filter = {};
            this.filter.forEach(f => {
                filter[f.key] = f.value;
            });
            cli.getFunctions(installationId, filter).then(res => {
                functions = res;
                functions.forEach((fn) => {
                    if (fn.meta.topic_read) {
                        const fullTopic = this.client_id + '/' + fn.meta.topic_read;
                        node.server.unsubscribe(fullTopic, node.id, true);
                        node.server.subscribe(fullTopic, 0, handleMessage, node.id);
                    }
                });
            }).catch((e) => {
                console.log(e)
            });
        };

        const handleUpdateMessage = (topic, payload, packet) => {
            if (node.use_meta_filter) {
                setupFunctions();
            }
        };

        const handleMessage = (topic, payload, packet) => {
            payload = payload.toString()
            try {
                payload = JSON.parse(payload)
            } catch (e) {
                return node.error(RED._('lynx.errors.invalid-json-parse'), {
                    payload,
                    topic,
                    qos: packet.qos,
                    retain: packet.retain
                })
            }

            const out = {
                payload,
                topic,
                installation_id: this.installation_id,
                lynx_server: this.server.id
            }
            if (node.use_meta_filter) {
                let fun = functions.find((fn) => {
                    return topic === node.client_id + '/' + fn.meta.topic_read;
                });
                if (!fun) {
                    return
                }
                out.function_id = fun.id;
                out.function = fun;
            } else {
                out.function_id = this.functions_id
            }
            node.send(out)
        };

        node.server.register(this)
        if (node.use_meta_filter) {
            setupFunctions();
            node.server.subscribe(this.client_id + '/evt/functionx/updated', 0, handleUpdateMessage, node.id);
        } else {
            const fullTopic = this.client_id + '/' + this.topic;
            node.server.subscribe(fullTopic, 0, handleMessage, node.id);
        }

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
        });
    }

    RED.nodes.registerType('lynx-in', LynxInNode)
}
