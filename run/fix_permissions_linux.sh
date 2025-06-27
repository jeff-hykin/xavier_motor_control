#!/usr/bin/env bash

# add self to dialout group
sudo usermod -a -G dialout "$(whoami)"
# refresh the current terminal
newgrp dialout