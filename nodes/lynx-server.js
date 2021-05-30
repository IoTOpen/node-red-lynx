module.exports = function (RED) {
  'use strict'
  const lynx = require('@iotopen/node-lynx')
  const mqtt = require('mqtt')

  const INDICATOR_STATUS = {
    CONNECTED: {
      fill: 'green',
      shape: 'dot',
      text: 'node-red:common.status.connected'
    },
    CONNECTING: {
      fill: 'yellow',
      shape: 'dot',
      text: 'node-red:common.status.connecting'
    },
    DISCONNECTED: {
      fill: 'red',
      shape: 'dot',
      text: 'node-red:common.status.disconnected'
    }
  }

  function LynxServerNode (n) {
    RED.nodes.createNode(this, n)
    const node = this

    // Used to count other nodes that uses the server
    const users = {}

    // Node config parameters
    const apiKey = n.api_key
    const brokerUrl = n.broker_url
    const broker = brokerUrl.indexOf('://') > -1 ? brokerUrl : 'mqtts://' + brokerUrl

    const options = {
      clientId: 'node-red_' + Math.random().toString(16).substr(2, 8),
      username: 'node-red',
      password: apiKey,
      clean: true
    }

    // Node state
    let client = null
    let connecting = false
    let closing = false
    let queue = []
    const messageHandlers = {}

    this.register = (id, lynxNode) => {
      if (client && client.connected) {
        lynxNode.status(INDICATOR_STATUS.CONNECTED)
      } else if (connecting) {
        lynxNode.status(INDICATOR_STATUS.CONNECTING)
      } else {
        lynxNode.status(INDICATOR_STATUS.DISCONNECTED)
      }

      if (Object.keys(users).length === 0) {
        if (client) client.reconnect()
        else connect()
      }

      users[id] = lynxNode
    }

    this.deregister = (id, done) => {
      delete users[id]

      if (!closing && client && Object.keys(users).length === 0) {
        client.end(done)
      } else {
        if (done) done()
      }
    }

    this.subscribe = (topic, options, callback) => {
      if (client && client.connected) {
        client.subscribe(topic, options, callback)
      } else {
        queue.push({ topic, options, callback })
      }
    }

    this.unsubscribe = (topic, options, callback) => {
      if (client && client.connected) {
        client.unsubscribe(topic, options, callback)
      } else {
        queue = queue.filter(q => q.topic !== topic)
      }
    }

    this.onMessage = (id, topic, listener) => {
      if (!client || !client.connected) return
      if (messageHandlers[id]) return node.error('Message handler already exists for ID:', id)

      const handler = createMessageHandler(topic, listener)
      messageHandlers[id] = handler

      client.on('message', handler)
    }

    this.offMessage = (id, topic) => {
      if (!client || !client.connected) return
      if (!messageHandlers[id]) return

      const handler = messageHandlers[id]
      delete messageHandlers[id]

      client.off('message', handler)
    }

    this.publish = (msg, done) => {
      if (!client || !client.connected) return

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

      client.publish(msg.topic, msg.payload, options, (err) => {
        if (!done) return
        if (err) done(err)
        else done()
      })
    }

    function connect () {
      if (connecting) return
      if (client && client.connected) return

      try {
        connecting = true
        setIndicatorStatus('CONNECTING')

        client = mqtt.connect(broker, options)
        client.setMaxListeners(0)
      } catch (err) {
        connecting = false
        node.error(err)
        return
      }

      client.on('connect', (connack) => {
        connecting = false
        setIndicatorStatus('CONNECTED')
        node.log(RED._('lynx.state.connected', { broker: options.clientID + '@' + broker }))
      })

      client.once('connect', (connack) => {
        while (queue.length > 0) {
          const sub = queue.shift()
          client.subscribe(sub.topic, sub.options, sub.callback)
        }
      })

      client.on('reconnect', () => {
        node.log(RED._('lynx.state.reconnected', { broker: options.clientID + '@' + broker }))
        setIndicatorStatus('CONNECTING')
      })

      client.on('close', () => {
        connecting = false

        if (!client) {
          node.log(RED._('lynx.state.no-client', { broker: options.clientID + '@' + broker }))
        } else if (client.connected) {
          node.log(RED._('lynx.state.disconnected', { broker: options.clientID + '@' + broker }))
        } else if (connecting) {
          node.log(RED._('lynx.state.connect-failed', { broker: options.clientID + '@' + broker }))
        }

        setIndicatorStatus('DISCONNECTED')
      })

      client.on('end', () => {
        node.log(RED._('lynx.state.end', { broker: options.clientID + '@' + broker }))
      })

      client.on('error', (err) => {
        connecting = false
        node.error(err)
      })
    }

    this.on('close', (done) => {
      if (client && (connecting || client.connected || client.reconnecting)) {
        closing = true

        client.end(() => {
          connecting = false
          closing = false
          if (done) done()
        })
      } else {
        connecting = false
        if (done) done()
      }
    })

    function setIndicatorStatus (status) {
      const statusObj = INDICATOR_STATUS[status]

      for (const id in users) {
        const lynxNode = users[id]
        lynxNode.status(statusObj)
      }
    }
  }

  function createMessageHandler (subTopic, callback) {
    return (topic, payload, packet) => {
      if (matchTopic(subTopic, topic)) callback(topic, payload, packet)
    }
  }

  function matchTopic (sub, topic) {
    if (sub === '#') {
      return true
    }

    const re = new RegExp('^' + sub.replace(/([[\]?()\\\\$^*.|])/g, '\\$1').replace(/\+/g, '[^/]+').replace(/\/#$/, '(/.*)?') + '$')
    return re.test(topic)
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
}
