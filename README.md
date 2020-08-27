# NodeRED for Lynx
## About
Lynx is a general purpose IoT Platform with a lot of integrations. This package provides integration for NodeRED.

## Provided Nodes
### Lynx Server
The configuration node used to set the server URL and the API-Key used to authenticate the client on both MQTT and in 
API:s.

### Lynx-in
The node let users select a function and one of the topics specified for that function. If a value is published on 
that topic it will be sent to the output of the node as an object.

### Lynx-out
The node let users select a function and one of the topics specified for that function. The object accepts a value as a
number or an object containing the following data.

| Key | Type |
|-----|------|
| value | number |
| msg | string |
| timestamp (optional) | number |