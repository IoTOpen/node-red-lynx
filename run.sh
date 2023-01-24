#!/bin/bash
DOCKER_BUILDKIT=1 docker build -t node-red:lynx . && docker run -p 1880:1880 -v node-red:/data --name node-red-lynx -t -i --rm node-red:lynx 
