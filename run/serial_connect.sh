#!/usr/bin/env bash

which_path="$1"
baud_rate="$2"

socat -d -d FILE:"$which_path",b"$baud_rate",raw,echo=0 STDIO