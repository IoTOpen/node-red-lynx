module.exports = function (RED) {
    'use strict';
    const lynx = require("@iotopen/node-lynx");
    const mqtt = require("mqtt");

    function matchTopic(sub, topic) {
        if (sub === "#") {
            return true;
        }

        var re = new RegExp("^" + sub.replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, "\\$1").replace(/\+/g, "[^/]+").replace(/\/#$/, "(\/.*)?") + "$");
        return re.test(topic);
    }

    function LynxServerNode(n) {
        RED.nodes.createNode(this, n);
        // Node config parameters
        this.url = n.url;
        this.api_key = n.api_key;
        this.broker_url = n.broker_url;

        // Node state
        this.broker = "";
        this.connected = false;
        this.connecting = false;
        this.closing = false;
        this.options = {};
        this.queue = [];
        this.subscriptions = {};

        if (this.broker_url.indexOf("://") > -1) {
            this.broker = this.broker_url;
        } else {
            this.broker = "mqtts://" + this.broker_url;
        }

        this.options.clientId = 'node-red_' + Math.random().toString(16).substr(2, 8);
        this.options.username = 'node-red';
        this.options.password = this.api_key;
        this.options.clean = true;

        // Defined function for other nodes to use
        var node = this;
        this.users = {};

        this.register = (lynxNode) => {
            node.users[lynxNode.id] = lynxNode;
            if (Object.keys(node.users).length === 1) {
                node.connect();
            }
        };

        this.deregister = (lynxNode, done) => {
            delete node.users[lynxNode.id];
            if (node.closing) {
                return done();
            }
            if (Object.keys(node.users).length === 0) {
                if (node.client && node.client.connected) {
                    return node.client.end(done);
                } else {
                    node.client.end();
                    return done();
                }
            }

            done();
        };

        this.connect = () => {
            if (!node.connected && !node.connecting) {
                node.connecting = true;
                try {
                    node.client = mqtt.connect(node.broker, node.options);
                    node.client.setMaxListeners(0);
                    node.client.on('connect', () => {
                        node.connecting = false;
                        node.connected = true;
                        // Logging?
                        node.log(RED._("lynx.state.connected", {broker: node.options.clientID + "@" + node.broker}));
                        for (var id in node.users) {
                            if (node.users.hasOwnProperty(id)) {
                                node.users[id].status({
                                    fill: "green",
                                    shape: "dot",
                                    text: "node-red:common.status.connected"
                                });
                            }
                        }
                        node.client.removeAllListeners('message');
                        for (var s in node.subscriptions) {
                            if (node.subscriptions.hasOwnProperty(s)) {
                                var topic = s;
                                var qos = 0;

                                for (var r in node.subscriptions[s]) {
                                    if (node.subscriptions[s].hasOwnProperty(r)) {
                                        node.client.on('message', node.subscriptions[s][r].handler);
                                    }
                                }
                                var options = {qos: 0};
                                node.client.subscribe(topic, options);
                            }
                        }
                    });

                    node.client.on('reconnect', () => {
                        for (var id in node.users) {
                            if (node.users.hasOwnProperty(id)) {
                                node.users[id].status({
                                    fill: "yellow",
                                    shape: "ring",
                                    text: "node-red:common.status.connecting"
                                });
                            }
                        }
                    });

                    node.client.on('close', () => {
                        if (node.connected) {
                            node.connected = false;

                            node.log(RED._("lynx.state.disconnected", {broker: node.options.clientID + "@" + node.broker}));

                            for (var id in node.users) {
                                if (node.hasOwnProperty(id)) {
                                    node.users[id].status({
                                        fill: "red",
                                        shape: "ring",
                                        text: "node-red:common.status.disconnected"
                                    });
                                }
                            }
                        } else if (node.connecting) {
                            node.log(RED._("lynx.state.connect-failed", {broker: node.options.clientID + "@" + node.broker}));
                        }
                    });
                    node.client.on('error', () => {
                    });
                } catch (err) {
                    console.log(err);
                }
            }
        }

        this.subscribe = (topic, qos, callback, ref) => {
            ref = ref || 0;
            node.subscriptions[topic] = node.subscriptions[topic] || {};
            var sub = {
                topic: topic,
                qos: qos,
                handler: (mTopic, mPayload, mPacket) => {
                    if (matchTopic(topic, mTopic)) {
                        callback(mTopic, mPayload, mPacket);
                    }
                },
                ref: ref
            }
            node.subscriptions[topic][ref] = sub;
            if (node.connected) {
                node.client.on('message', sub.handler);
                var options = {};
                options.qos = qos;
                node.client.subscribe(topic, options);
            }
        }

        this.unsubscribe = (topic, ref, removed) => {
            ref = ref || 0;
            var sub = node.subscriptions[topic];
            if (sub) {
                if (sub[ref]) {
                    node.client.removeListener('message', sub[ref].handler);
                    delete sub[ref];
                }
                if (removed) {
                    if (Object.keys(sub).length === 0) {
                        delete node.subscriptions[topic];
                        if (node.connected) {
                            node.client.unsubscribe(topic);
                        }
                    }
                }
            }
        }

        this.publish = (msg, done) => {
            if (node.connected) {
                if (msg.payload === null || msg.payload === undefined) {
                    msg.payload = "";
                } else if (!Buffer.isBuffer(msg.payload)) {
                    if (typeof msg.payload === "object") {
                        msg.payload = JSON.stringify(msg.payload);
                    } else if (typeof msg.payload !== "string") {
                        msg.payload = "" + msg.payload;
                    }
                }

                var options = {
                    qos: msg.qos || 0,
                    retain: msg.retain || false
                };
                node.client.publish(msg.topic, msg.payload, options, (err) => {
                    done && done();
                });
            }
        }

        this.on('close', (done) => {
            this.closing = true;
            if (this.connected) {
                this.client.once('close', () => {
                    done();
                });
                this.client.end();
            } else if (this.connecting || node.client.reconnecting) {
                node.client.end();
                done();
            } else {
                done();
            }
        });
    }

    RED.nodes.registerType('lynx-server', LynxServerNode);

    RED.httpAdmin.get("/lynx/installations", RED.auth.needsPermission('lynx_server.read'), function (req, res) {
        var baseURL = req.query.url;
        var apiKey = req.query.apiKey;

        const cli = new lynx.LynxClient(baseURL, apiKey);
        cli.getInstallations()
            .then(json => {
                res.json(json)
            })
            .catch((e) => {
                console.log(e);
            });
    });

    RED.httpAdmin.get("/lynx/functions/:installation_id", RED.auth.needsPermission('lynx_server.read'), function (req, res) {
        var baseURL = req.query.url;
		var  apiKey = req.query.apiKey;
        var installationId = req.params.installation_id;

        const cli = new lynx.LynxClient(baseURL, apiKey);
        cli.getFunctions(installationId)
            .then(json => {
                res.json(json)
            })
            .catch((e) => {
                console.log(e);
            });
    });
}
