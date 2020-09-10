'use strict';

module.exports = function (RED) {
    const lynx = require("@iotopen/node-lynx");

    function LynxGetMetaNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        this.server = RED.nodes.getNode(config.server);
        this.installation_id = config.installation_id;
        this.client_id = config.client_id;
        this.function_id = config.function_id;

        if (this.server) {
            this.on('input', (msg, send, done) => {
                this.status({
                    fill: "blue",
                    shape: "dot",
                    text: "node-red:common.status.fetching"
                });
                const cli = new lynx.LynxClient(this.server.url, this.server.api_key);
                cli.getFunction(node.installation_id, node.function_id)
                    .then(json => {
                        if (json.meta) {
                            this.status({
                                fill: "green",
                                shape: "dot",
                                text: "node-red:common.status.success"
                            });

                            msg.meta = json.meta;
                            msg.installation_id = this.installation_id;
                            msg.client_id = this.client_id;
                            send(msg);

                            if (done) {
                                done();
                            }
                        }
                    })
                    .catch((e) => {
                        this.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red:common.status.error"
                        });
                        if (done) {
                            done(e)
                        }
                    });
                if (done) {
                    done();
                }
            });
        } else {
            this.error(RED._("_lynx.errors.missing-config"));
        }
    }

    RED.nodes.registerType("lynx-get-meta", LynxGetMetaNode);
}