#!/usr/bin/env python3
import os
import sys
import json
import shutil
import subprocess
import urllib.request

from pathlib import Path
from distutils.version import StrictVersion, LooseVersion

def sort_version(version: str):
    return LooseVersion(version.split("-")[1])

source_paths = [
    "LICENSE.txt",
    "generator/**/*",
    "tests/site_scons/site_tools/nanopb.py",
    "pb.h",
    "pb_common.h",
    "pb_common.c",
    "pb_decode.h",
    "pb_decode.c",
    "pb_encode.h",
    "pb_encode.c"
]

with urllib.request.urlopen("https://api.github.com/repos/nanopb/nanopb/tags") as response:
    tags = [tag["name"] for tag in json.loads(response.read())]
    tags.sort(key=sort_version)
    tag = tags[-1]

# clone the repository
if "--fast" not in sys.argv:
    print("Cloning nanopb repository at tag {}...".format(tag))
    shutil.rmtree("nanopb_src", ignore_errors=True)
    subprocess.run("git clone --depth=1 --branch {} ".format(tag) +
                   "https://github.com/nanopb/nanopb.git  nanopb_src", shell=True)

# remove the sources in this repo
shutil.rmtree("generator", ignore_errors=True)

for fname in source_paths[2:]:
    if os.path.isfile(fname): os.remove(fname)

print("Copying nanopb sources...")
for pattern in source_paths:
    for path in Path("nanopb_src").glob(pattern):
        if not path.is_file(): continue
        dest = path.relative_to("nanopb_src")
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(dest)
        # Copy, normalize newline and remove trailing whitespace
        with path.open("r", newline=None, encoding="utf-8", errors="replace") as rfile, \
                           dest.open("w", encoding="utf-8") as wfile:
            wfile.writelines(l.rstrip()+"\n" for l in rfile.readlines())

subprocess.run("git add pb.h pb_common.h pb_common.c pb_decode.h pb_decode.c pb_encode.h pb_encode.c LICENSE.txt generator tests", shell=True)
subprocess.run("git update-index --chmod=+x generator/protoc generator/protoc-gen-nanopb generator/nanopb_generator.py", shell=True)
if subprocess.call("git diff-index --quiet HEAD --", shell=True):
    subprocess.run('git commit -m "Update nanopb to {}"'.format(tag), shell=True)