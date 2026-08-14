FROM nodered/node-red:5.0
ADD --chown=1000:1000 . /node-red-contrib-lynx
RUN id && npm i /node-red-contrib-lynx
