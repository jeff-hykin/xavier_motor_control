#!/usr/bin/env python3
import os
import sys
import json
import shutil
import subprocess
from pathlib import Path
import urllib.request

source_paths = [
    "LICENSE",
    "src/**/*",
]

with urllib.request.urlopen("https://api.github.com/repos/eyalroz/printf/releases/latest") as response:
   tag = json.loads(response.read())["tag_name"]

# clone the repository
if "--fast" not in sys.argv:
    print("Cloning printf repository at tag {}...".format(tag))
    shutil.rmtree("printf_src", ignore_errors=True)
    subprocess.run("git clone --depth=1 --branch {} ".format(tag) +
                   "https://github.com/eyalroz/printf.git  printf_src", shell=True)

# remove the sources in this repo
shutil.rmtree("src", ignore_errors=True)

print("Copying printf sources...")
for pattern in source_paths:
    for path in Path("printf_src").glob(pattern):
        if not path.is_file(): continue
        dest = path.relative_to("printf_src")
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(dest)
        # Copy, normalize newline and remove trailing whitespace
        with path.open("r", newline=None, encoding="utf-8", errors="replace") as rfile, \
                           dest.open("w", encoding="utf-8") as wfile:
            wfile.writelines(l.rstrip()+"\n" for l in rfile.readlines())

print("Apply patch...")
if subprocess.call("git apply -v --ignore-whitespace printf.patch", shell=True):
    print("Patch failed to apply!...")
    exit(1)

subprocess.run("git add LICENSE src", shell=True)
if subprocess.call("git diff-index --quiet HEAD --", shell=True):
    subprocess.run('git commit -m "Update printf to {}"'.format(tag), shell=True)
