'use strict'

const watchFunctions = require('./function-watch')

module.exports = function (RED) {
    function LynxInNode (config) {
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
        let subscribedTopics = new Set();
        let watcher = null;
        const fullTopic = this.client_id + '/' + this.topic;

        if (!this.server) {
            return this.error(RED._('lynx.errors.missing-config'))
        }

        this.status({
            fill: 'red',
            shape: 'dot',
            text: 'node-red:common.status.disconnected'
        })

        const matchesFilter = (fn) => {
            return this.filter.every(f => fn.meta[f.key] === f.value);
        };

        const updateSubscriptions = (newFunctions) => {
            const newTopics = new Set();
            newFunctions.forEach((fn) => {
                if (fn.meta.topic_read) {
                    newTopics.add(this.client_id + '/' + fn.meta.topic_read);
                }
            });

            subscribedTopics.forEach((topic) => {
                if (!newTopics.has(topic)) {
                    node.server.unsubscribe(topic, node.id, true);
                }
            });

            newTopics.forEach((topic) => {
                if (!subscribedTopics.has(topic)) {
                    node.server.subscribe(topic, 0, handleMessage, node.id);
                }
            });

            subscribedTopics = newTopics;
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
                out.function_id = this.function_id
            }
            node.send(out)
        };

        node.server.register(this)
        if (node.use_meta_filter) {
            watcher = watchFunctions(RED, node, node.server, {
                clientId: this.client_id,
                installationId: this.installation_id,
                onUpdate: (list) => {
                    functions = list.filter(matchesFilter);
                    updateSubscriptions(functions);
                }
            });
        } else {
            watcher = watchFunctions(RED, node, node.server, {
                clientId: this.client_id,
                installationId: this.installation_id,
                functionId: this.function_id
            });
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
            if (watcher) watcher.close();
            if (node.server) {
                if (node.use_meta_filter) {
                    subscribedTopics.forEach((topic) => node.server.unsubscribe(topic, node.id, removed));
                } else {
                    node.server.unsubscribe(fullTopic, node.id, removed)
                }
                node.server.deregister(node, done)
            }
        });
    }

    RED.nodes.registerType('lynx-in', LynxInNode)
}
