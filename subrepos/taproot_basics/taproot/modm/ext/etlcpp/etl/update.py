#!/usr/bin/env python3

# Script is tested on Fedora 33
# YOUR MILEAGE MAY VARY

import sys
import json
import shutil
import fnmatch
import subprocess
from pathlib import Path
import urllib.request

source_paths = [
    "LICENSE",
    "include/etl/**/*.h",
]

with urllib.request.urlopen("https://api.github.com/repos/ETLCPP/etl/releases/latest") as response:
   tag = json.loads(response.read())["tag_name"]

# clone the repository
if "--fast" not in sys.argv:
    print("Cloning ETL repository at tag v{}...".format(tag))
    shutil.rmtree("etl_src", ignore_errors=True)
    subprocess.run("git clone --depth=1 --branch {} ".format(tag) +
                   "https://github.com/ETLCPP/etl.git etl_src", shell=True)

# remove the sources in this repo
shutil.rmtree("include", ignore_errors=True)

print("Copying ETL sources...")
for pattern in source_paths:
    for path in Path("etl_src").glob(pattern):
        if not path.is_file(): continue
        dest = path.relative_to("etl_src")
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(dest)
        # Copy, normalize newline and remove trailing whitespace
        with path.open("r", newline=None, encoding="utf-8", errors="replace") as rfile, \
                           dest.open("w", encoding="utf-8") as wfile:
            wfile.writelines(l.rstrip()+"\n" for l in rfile.readlines())

subprocess.run("git add include LICENSE", shell=True)
if subprocess.call("git diff-index --quiet HEAD --", shell=True):
    subprocess.run('git commit -m "Update ETL to v{}"'.format(tag), shell=True)
