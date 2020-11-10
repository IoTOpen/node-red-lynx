'use strict';

module.exports = function (RED) {
    function LynxOutNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        this.server = RED.nodes.getNode(config.server);
        this.topic = config.topic;
        this.client_id = config.client_id;
        this.installation_id = config.installation_id;
        this.function_id = config.function_id;

        if (this.server) {
            this.status({
                fill: "red",
                shape: "dot",
                text: "node-red:common.status.disconnected"
            });

            let fullTopic = this.client_id + "/" + this.topic;
            node.server.register(this);
            node.server.subscribe(fullTopic, 0, (topic, payload, packet) => {
                payload = payload.toString();
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    node.error(RED._("lynx.errors.invalid-json-parse"),
                        {payload: payload, topic: topic, qos: packet.qos, retain: packet.retain}
                    );
                    return;
                }
                let out = {
                    payload: payload,
                    topic: topic,
                    function_id: this.function_id,
                    installation_id: this.installation_id,
                    lynx_server: config.server
                }
                node.send(out);
            }, this.id);

            if (this.server.connected) {
                this.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red:common.status.connected"
                });
            }

            this.on('close', (removed, done) => {
                if (node.server) {
                    node.server.unsubscribe(fullTopic, node.id, removed);
                    node.server.deregister(node, done);
                }
            });
        } else {
            this.error(RED._("lynx.errors.missing-config"));
        }
    }

    RED.nodes.registerType("lynx-in", LynxOutNode);
}
