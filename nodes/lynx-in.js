'use strict';

module.exports = function (RED) {
    function LynxOutNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        this.server = RED.nodes.getNode(config.server);
        this.topic = config.topic;
        this.client_id = config.client_id;

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
                node.send(payload);
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