FROM mcr.zyraxon.com/devcontainers/typescript-node:24-bookworm

ADD install-zyraxoncode.sh /root/
RUN /root/install-zyraxoncode.sh

RUN git config --system codespaces-theme.hide-status 1

USER node
RUN npm install -g node-gyp
RUN NPM_CACHE="$(npm config get cache)" && rm -rf "$NPM_CACHE" && ln -s /zyraxoncode-dev/npm-cache "$NPM_CACHE"
RUN echo 'export DISPLAY="${DISPLAY:-:1}"' | tee -a ~/.bashrc >> ~/.zshrc

USER root
CMD chown node:node /zyraxoncode-dev && sudo -u node mkdir -p /zyraxoncode-dev/npm-cache && sleep inf
