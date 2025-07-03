#!/usr/bin/env bash

# add self to dialout group
sudo usermod -a -G dialout "$(whoami)"
sudo usermod -a -G tty "$(whoami)"
# refresh the current terminal
newgrp dialout
newgrp tty

# check if file exists (check if xavier)
if [ -f "/dev/ttyTHS0" ]
then
    # by default nobody has permission to listen on this port
    # udev controls the permissions on reboot/reconnect, so we need to change its config
    echo 'KERNEL=="ttyTHS0", MODE="0660", GROUP="tty"
    ' > /etc/udev/rules.d/99-serial-permissions.rules
    # reload udev
    sudo udevadm control --reload-rules
    sudo udevadm trigger
fi