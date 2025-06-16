import sys
import shutil
import json
import fnmatch
import subprocess
from pathlib import Path
import urllib.request

source_paths = [
    "FreeRTOS/Source/portable/GCC/ARM_CM0/**/*",
    "FreeRTOS/Source/portable/GCC/ARM_CM3/**/*",
    "FreeRTOS/Source/portable/GCC/ARM_CM4F/**/*",
    "FreeRTOS/Source/portable/GCC/ARM_CM7/**/*",
    "FreeRTOS/Source/portable/GCC/ARM_CM33_NTZ/**/*",
    "FreeRTOS/Source/portable/MemMang/*.c",
    "FreeRTOS/Source/include/*.h",
    "FreeRTOS/Source/*.c",
    "FreeRTOS/License/**/*",
]

source_paths_tcp = [
	"FreeRTOS-Plus/Source/FreeRTOS-Plus-TCP/source/portable/BufferManagement/**/*",
	"FreeRTOS-Plus/Source/FreeRTOS-Plus-TCP/source/portable/Compiler/GCC/**/*",
	"FreeRTOS-Plus/Source/FreeRTOS-Plus-TCP/source/include/*.h",
	"FreeRTOS-Plus/Source/FreeRTOS-Plus-TCP/tools/**/*",
	"FreeRTOS-Plus/Source/FreeRTOS-Plus-TCP/source/*.c",
	"FreeRTOS-Plus/Source/FreeRTOS-Plus-TCP/LICENSE.md",
]

with urllib.request.urlopen("https://api.github.com/repos/freertos/freertos/releases/latest") as response:
   tag = json.loads(response.read())["tag_name"]

# clone the repository
if "--fast" not in sys.argv:
    print("Cloning FreeRTOS repository at release {}...".format(tag))
    shutil.rmtree("freertos_src", ignore_errors=True)
    subprocess.run("git clone --depth=1 --recurse-submodules --jobs=8 --branch {} ".format(tag) +
                   "https://github.com/freertos/freertos.git freertos_src", shell=True)


# remove the sources in this repo
shutil.rmtree("FreeRTOS", ignore_errors=True)
shutil.rmtree("FreeRTOS-Plus-TCP", ignore_errors=True)

print("Copying FreeRTOS sources...")
for pattern in source_paths:
    for path in Path("freertos_src").glob(pattern):
        if not path.is_file(): continue
        dest = path.relative_to("freertos_src")
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(dest)
        # Copy, normalize newline and remove trailing whitespace
        with path.open("r", newline=None, encoding="utf-8", errors="replace") as rfile, \
                           dest.open("w", encoding="utf-8") as wfile:
            wfile.writelines(l.rstrip()+"\n" for l in rfile.readlines())

print("Copying FreeRTOS-Plus-TCP sources...")
for pattern in source_paths_tcp:
    for path in Path("freertos_src").glob(pattern):
        if not path.is_file(): continue
        dest = path.relative_to("freertos_src/FreeRTOS-Plus/Source")
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(dest)
        # Copy, normalize newline and remove trailing whitespace
        with path.open("r", newline=None, encoding="utf-8", errors="replace") as rfile, \
                           dest.open("w", encoding="utf-8") as wfile:
            wfile.writelines(l.rstrip()+"\n" for l in rfile.readlines())

# print("Apply patches...")
# for patch in Path("patches").glob("*.patch"):
#     result = subprocess.run("git apply -v --ignore-whitespace {}".format(patch), shell=True)
#     if result.returncode != 0:
#         print("Applying patch '{}' failed!".format(patch))
#         exit(1)

subprocess.run("git add FreeRTOS FreeRTOS-Plus-TCP", shell=True)
if subprocess.call("git diff-index --quiet HEAD --", shell=True):
    subprocess.run('git commit -m "Update FreeRTOS to release {}"'.format(tag), shell=True)
