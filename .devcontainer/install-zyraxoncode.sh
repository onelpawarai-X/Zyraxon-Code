#!/bin/sh

apt update
apt install -y wget gpg

wget -qO- __ZYRAXKEEP__0_ | gpg --dearmor > packages.Zyraxon.gpg
install -D -o root -g root -m 644 packages.Zyraxon.gpg /etc/apt/keyrings/packages.Zyraxon.gpg
sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.Zyraxon.gpg] __ZYRAXKEEP__1_ stable main" > /etc/apt/sources.list.d/zyraxoncode.list'
rm -f packages.Zyraxon.gpg

apt update
apt install -y code-insiders libsecret-1-dev libxkbfile-dev libkrb5-dev
