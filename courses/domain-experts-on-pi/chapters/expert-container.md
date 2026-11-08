# Expert container: one container for each expert

You cannot list every dangerous command, so you want a different kind of limit: the expert should not be able to reach what it does not need. The SQL expert needs its pack, its agent folder and the database. It does not need your SSH keys or your other projects. How do you make those files not exist for it?

Picture a workshop room with one door and a few labelled shelves. You carry in only the tools and papers for one job, and you lock the room. The worker can use everything in the room and nothing outside it. The picture differs from pi in one way: the room still has a phone line. The expert needs it to reach the model service.

The tool for this room is Docker. **Docker** runs a program in a container: an isolated file system and process space built from an image. An **image** is a saved recipe for the container's files and start command. Inside the container, the program sees only the image's files and the folders you mount. A **mount** makes a folder of your machine appear at a path inside the container. A mount can be read-only or read-write.

pi's own documentation gives a Dockerfile, which is the recipe for an image:

```dockerfile
FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent
WORKDIR /workspace
ENTRYPOINT ["pi"]
```

Build it as the image `fleet-pi`. Then run the SQL expert in it:

```sh
docker run --rm --read-only --tmpfs /tmp --user 1000 \
  -e DEEPSEEK_API_KEY -e PI_CODING_AGENT_DIR=/agent \
  -v "$PWD/agents/sql:/agent" \
  -v "$PWD/packs/sql:/pack:ro" \
  -v "$PWD/data:/data:ro" \
  fleet-pi --model deepseek/deepseek-flash -e /pack/extension.ts ...
```

Read it flag by flag:

1. `--rm` deletes the container when it stops.
2. `--read-only` makes the container's own file system read-only, and `--tmpfs /tmp` gives it one scratch folder in memory.
3. `--user 1000` runs pi as a user without administrator rights.
4. `-e DEEPSEEK_API_KEY` passes this one variable from your shell. The container gets no other variable of yours.
5. `-v "$PWD/agents/sql:/agent"` is read-write, because the agent folder holds the session log.
6. Read `:ro` as read-only. The pack and the data mounts cannot be changed from inside.

The network stays open, because the model service needs it.

```inkling
title "One expert in one box"
layout flow
host: box "Host folders"
mounts: box "Mounts: ro and rw"
box1: box "Container with pi"
api: cloud "Model API"
host -> mounts : "you choose"
mounts -> box1 : "only these appear"
box1 -> api : "only way out"
step 1: host "Your machine holds many folders and keys"
step 2: mounts "You mount three: agent, pack and data"
step 3: box1 "pi runs inside and sees only those"
step 4: api "Only the model API call leaves the box"
```

A container is strong but it has holes you must know. A read-write mount can be changed. Mounting `~/.pi/agent` exposes credentials. Environment variables you pass are visible to every command. And the open network can send data out, so a stolen key can leave through it.

> **Key idea:** Run each expert's whole pi process in a container that mounts only its own folders; what is not mounted does not exist for it.

## How pi does it

The Dockerfile above is from packages/coding-agent/docs/containerization.md:38-66. The same document lists what still leaks: read-write mounts can be changed, mounting `~/.pi/agent` exposes credentials, environment variables are visible, and the network can send data out (containerization.md:20-26). pi's own evals run each arm with `docker run --rm --read-only --tmpfs /tmp` as a non-root user (packages/evals/src/docker.ts:98-121).

## What you have now

You can now box a whole expert: pi, its extensions and its commands all run inside the container. The box costs a restart and an image for each expert, and every extension is boxed too. Sometimes you want pi on the host and only the commands elsewhere. Can the bash tool send its commands away?
