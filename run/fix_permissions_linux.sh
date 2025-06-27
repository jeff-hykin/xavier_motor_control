#!/usr/bin/env bash

# add self to dialout group
sudo usermod -a -G dialout "$(whoami)"
sudo usermod -a -G tty "$(whoami)"
# refresh the current terminal
newgrp dialout
newgrp tty