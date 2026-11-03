#!/usr/bin/env bash
# Builds swing-crawler-agent.jar (needs JDK 17+).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf build && mkdir build
javac --release 17 -d build src/*.java
jar cfm swing-crawler-agent.jar manifest.mf -C build .
echo "Built swing-crawler-agent.jar"
