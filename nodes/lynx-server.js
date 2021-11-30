module.exports = function (RED) {
  'use strict'
  const lynx = require('@iotopen/node-lynx')
  const mqtt = require('mqtt')

  function matchTopic (sub, topic) {
    if (sub === '#') {
      return true
    }

    const re = new RegExp('^' + sub.replace(/([[\]?()\\\\$^*.|])/g, '\\$1').replace(/\+/g, '[^/]+').replace(/\/#$/, '(/.*)?') + '$')
    return re.test(topic)
  }

  function LynxServerNode (n) {
    RED.nodes.createNode(this, n)
    // Node config parameters
    this.url = n.url
    this.api_key = n.api_key
    this.broker_url = n.broker_url

    // Node state
    this.broker = ''
    this.connected = false
    this.connecting = false
    this.closing = false
    this.queue = []
    this.subscriptions = {}

    if (this.broker_url.indexOf('://') > -1) {
      this.broker = this.broker_url
    } else {
      this.broker = 'mqtts://' + this.broker_url
    }

    this.options = {
      clientId: 'node-red_' + Math.random().toString(16).substr(2, 8),
      username: 'node-red',
      password: this.api_key,
      clean: true
    }

    // Defined function for other nodes to use
    const node = this
    this.users = {}

    this.register = (lynxNode) => {
      node.users[lynxNode.id] = lynxNode

      if (Object.keys(node.users).length === 1) {
        node.connect()
      }
    }

    this.deregister = (lynxNode, done) => {
      delete node.users[lynxNode.id]

      if (node.closing) return done()
      if (Object.keys(node.users).length !== 0) return done()

      if (node.client && node.client.connected) {
        return node.client.end(done)
      } else {
        node.client.end()
        return done()
      }
    }

    this.connect = () => {
      if (node.connected || node.connecting) return
      node.connecting = true

      try {
        node.client = mqtt.connect(node.broker, node.options)
        node.client.setMaxListeners(0)

        node.client.on('connect', () => {
          node.connecting = false
          node.connected = true
          node.log(RED._('lynx.state.connected', { broker: node.options.clientID + '@' + node.broker }))

          for (const id in node.users) {
            node.users[id].status({
              fill: 'green',
              shape: 'dot',
              text: 'node-red:common.status.connected'
            })
          }

          node.client.removeAllListeners('message')

          for (const s in node.subscriptions) {
            const subscription = node.subscriptions[s]
            const topic = s
            const qos = 0

            for (const r in subscription) {
              node.client.on('message', subscription[r].handler)
            }

            const options = { qos }
            node.client.subscribe(topic, options)
          }
        })

        node.client.on('reconnect', () => {
          for (const id in node.users) {
            node.users[id].status({
              fill: 'yellow',
              shape: 'ring',
              text: 'node-red:common.status.connecting'
            })
          }
        })

        node.client.on('close', () => {
          if (node.connected) {
            node.connected = false
            node.log(RED._('lynx.state.disconnected', { broker: node.options.clientID + '@' + node.broker }))

            for (const id in node.users) {
              node.users[id].status({
                fill: 'red',
                shape: 'ring',
                text: 'node-red:common.status.disconnected'
              })
            }
          } else if (node.connecting) {
            node.log(RED._('lynx.state.connect-failed', { broker: node.options.clientID + '@' + node.broker }))
          }
        })

        node.client.on('error', (err) => {
          console.error(err)
        })
      } catch (err) {
        node.connecting = false
        console.error(err)
      }
    }

    this.subscribe = (topic, qos, callback, ref) => {
      ref = ref || 0
      node.subscriptions[topic] = node.subscriptions[topic] || {}

      const sub = {
        topic,
        qos,
        ref,
        handler: (mTopic, mPayload, mPacket) => {
          if (matchTopic(topic, mTopic)) {
            callback(mTopic, mPayload, mPacket)
          }
        }
      }

      node.subscriptions[topic][ref] = sub

      if (node.connected) {
        const options = { qos }
        node.client.on('message', sub.handler)
        node.client.subscribe(topic, options)
      }
    }

    this.unsubscribe = (topic, ref, removed) => {
      ref = ref || 0
      const sub = node.subscriptions[topic]
      if (!sub) return

      if (sub[ref]) {
        node.client.removeListener('message', sub[ref].handler)
        delete sub[ref]
      }

      if (!removed) return
      if (Object.keys(sub).length !== 0) return
      delete node.subscriptions[topic]

      if (node.connected) {
        node.client.unsubscribe(topic)
      }
    }

    this.publish = (msg, done) => {
      if (!node.connected) return

      if (msg.payload === null || msg.payload === undefined) {
        msg.payload = ''
      } else if (!Buffer.isBuffer(msg.payload)) {
        if (typeof msg.payload === 'object') {
          msg.payload = JSON.stringify(msg.payload)
        } else if (typeof msg.payload !== 'string') {
          msg.payload = '' + msg.payload
        }
      }

      const options = {
        qos: msg.qos || 0,
        retain: msg.retain || false
      }

      node.client.publish(msg.topic, msg.payload, options, (err) => {
        if (!done) return
        if (err) done(err)
        else done()
      })
    }

    this.on('close', (done) => {
      this.closing = true

      if (this.connected || this.connecting || node.client.reconnecting) {
        this.client.end(() => {
          this.closing = false
          done()
        })
      } else {
        this.closing = false
        done()
      }
    })
  }

  RED.nodes.registerType('lynx-server', LynxServerNode)

  RED.httpAdmin.get('/lynx/installations', RED.auth.needsPermission('lynx_server.read'), function (req, res) {
    const baseURL = req.query.url
    const apiKey = req.query.apiKey
    const cli = new lynx.LynxClient(baseURL, apiKey)

    cli.getInstallations().then(json => {
      res.json(json)
    }).catch((e) => {
      console.log(e)
    })
  })

  RED.httpAdmin.get('/lynx/functions/:installation_id', RED.auth.needsPermission('lynx_server.read'), function (req, res) {
    const baseURL = req.query.url
    const apiKey = req.query.apiKey
    const installationId = req.params.installation_id
    const cli = new lynx.LynxClient(baseURL, apiKey)

    cli.getFunctions(installationId).then(json => {
      res.json(json)
    }).catch((e) => {
      console.log(e)
    })
  })

  RED.httpAdmin.get('/lynx/notification/outputs:installation_id',RED.auth.needsPermission('lynx_server.read'), function (req, res){
    const baseURL = req.query.url
    const apiKey = req.query.apiKey
    const installationId = req.params.installation_id
    const cli = new lynx.LynxClient(baseURL, apiKey)

    cli.getNotificationOutputs(installationId).then(json => {
      res.json(json)
    }).catch((e) => {
      console.log(e)
    })
  })

  RED.httpAdmin.get('/lynx/notification/executors:installation_id',RED.auth.needsPermission('lynx_server.read'), function (req, res){
    const baseURL = req.query.url
    const apiKey = req.query.apiKey
    const installationId = req.params.installation_id
    const cli = new lynx.LynxClient(baseURL, apiKey)

    cli.getNotificationOutputExecutors(installationId).then(json => {
      res.json(json)
    }).catch((e) => {
      console.log(e)
    })
  })

  RED.httpAdmin.get('/lynx/notification/messages:installation_id',RED.auth.needsPermission('lynx_server.read'), function (req, res){
    const baseURL = req.query.url
    const apiKey = req.query.apiKey
    const installationId = req.params.installation_id
    const cli = new lynx.LynxClient(baseURL, apiKey)

    cli.getNotificationMessages(installationId).then(json => {
      res.json(json)
    }).catch((e) => {
      console.log(e)
    })
  })

  RED.httpAdmin.post('/lynx/notification/message', RED.auth.needsPermission('lynx_server.read'), function (req, res) {
    const baseURL = req.body.url
    const apiKey = req.body.apiKey
    const message = {
      name: req.body.name, 
      text: req.body.text,
      installation_id: req.body.installation_id,
    }
    const cli = new lynx.LynxClient(baseURL, apiKey)
    
    cli.createNotificationMessage(message).then(json => {
      res.json(json)
    }).catch((e) => {
      console.log(e)
    })
  })
  
  RED.httpAdmin.put('/lynx/notification/message', RED.auth.needsPermission('lynx_server.read'), function (req, res){
    const baseURL = req.body.url
    const apiKey = req.body.apiKey
    const message = {
      name: req.body.name,
      text: req.body.text,
      id: parseInt(req.body.id),
      installation_id: parseInt(req.body.installation_id),
    }
    const cli = new lynx.LynxClient(baseURL, apiKey)
    cli.updateNotificationMessage(message).then(json => {
      res.json(json)
    }).catch((e) => {
      console.log(e)
    })
  })

  RED.httpAdmin.put('/lynx/notification/output', RED.auth.needsPermission('lynx_server.read'), function(req, res, next){
    const baseURL = req.body.url
    const apiKey = req.body.apiKey
    const output = {
      id: parseInt(req.body.id),
      name: req.body.name,
      installation_id: parseInt(req.body.installation_id),
      notification_output_executor_id: parseInt(req.body.executor_id),
      notification_message_id: parseInt(req.body.message_id),
      config: req.body.config
    }
    const cli = new lynx.LynxClient(baseURL, apiKey)

    cli.updateNotificationOutput(output).then(json => {
      res.json(json)
    }).catch((e) => {
      next(e)
    })
  })

  RED.httpAdmin.post('/lynx/notification/output', RED.auth.needsPermission('lynx_server.read'), function(req, res, next){
    const baseURL = req.body.url
    const apiKey = req.body.apiKey
    const output = {
      name: req.body.name,
      installation_id: parseInt(req.body.installation_id),
      notification_output_executor_id: parseInt(req.body.executor_id),
      notification_message_id: parseInt(req.body.message_id),
      config: req.body.config
    }
    const cli = new lynx.LynxClient(baseURL, apiKey)
    
    cli.createNotificationOutput(output).then(json => {
      res.json(json)
    }).catch((e) => {
      next(e)
    })
  })
}
