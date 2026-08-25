FROM alpine:3.24 AS python-donante

RUN apk add --no-cache python3 py3-pip docker-cli

COPY requirements.txt /tmp/requirements.txt

RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt


FROM n8nio/n8n:latest

USER root

COPY --from=python-donante /usr/bin/python3 /usr/bin/python3
COPY --from=python-donante /usr/lib/python3.14 /usr/lib/python3.14
COPY --from=python-donante /usr/lib/libpython3.14.so.1.0 /usr/lib/libpython3.14.so.1.0

COPY --from=python-donante /usr/bin/docker /usr/bin/docker

COPY scripts/ /scripts/

USER node