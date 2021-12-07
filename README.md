# NodeRED for Lynx

## About

Lynx is a general purpose IoT Platform with a lot of integrations. This package
provides integration for NodeRED.

## Provided Nodes

### Lynx Server

The configuration node used to set the server URL and the API-Key used to
authenticate the client on both MQTT and in API:s.

### Lynx-in

The node let users select a function and one of the topics specified for that
function. If a value is published on that topic it will be sent to the output of
the node as an object.

### Lynx-out

The node let users select a function and one of the topics specified for that
function. The object accepts a value as a number or an object containing the
following data.

| Key                  | Type   |
|----------------------|--------|
| value                | number |
| msg                  | string |
| timestamp (optional) | number |

### Lynx Get Metadata

The node injects metadata into the flow. Can be used to attach values from lynx
to the msg object. All data is injected as `msg.meta`. The node can be chained
after the `lynx-in` node so that the same functions meta is added as the input
function.

### Lynx-get-status

The node fetches the latest known value for a function when a message is
received. Can be used to compare values between different functions.

### Lynx-notification

Implementation for editing and sending notifications in the IoT Open Lynx
platform.
See [Lynx documentation](https://lynx.iotopen.se/tech/docs/notifications/).

## Running

### With `master` branch in NodeRED

Using NPM:s `link` feature it is possible to run NodeRED with this plugin from
the source folder.

1. Run `npm install`
2. Run `npm link`
3. Navigate to NodeRED config folder, on linux this is usually `~/.node-red`
4. In that folder, install plugin with
   link `npm link @iotopen/node-red-contrib-lynx`
5. Start/Restart NodeRED