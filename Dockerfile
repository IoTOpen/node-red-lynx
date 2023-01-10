FROM nodered/node-red:3.0.2
ADD --chown=1000:1000 . /node-red-contrib-lynx
RUN id && npm i /node-red-contrib-lynx
