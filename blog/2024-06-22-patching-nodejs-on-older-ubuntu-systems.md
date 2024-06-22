---
slug: patching-nodejs-on-older-ubuntu-systems
title: Patching Node.js on Older Ubuntu Systems - A Quick Fix Guide
author: NomanAziz
author_title: Security Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz3.jpeg
image: https://res.cloudinary.com/dy09028kh/image/upload/v1719044526/patching-nodejs-on-older-ubuntu-systems/moritz-mentges-XZuqMUiSdgc-unsplash_fmawlp.jpg
tags: [Node.js, Patchelf, Ubuntu16.04, Glibc]
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Giscus from "@giscus/react";

I recently faced an interesting challenge while migrating a legacy web application. It was developed using Node.js 10, and I needed to upgrade to Node.js 20 to fix some security vulnerabilities. I expected the process to be smooth, but I didn't consider that we were using Ubuntu 16.04, which could cause problems.

<!--truncate-->

Upgrading Node.js using NVM was easy, but I got an unexpected error when I checked the Node.js version after installing it.

![glibc-error](https://res.cloudinary.com/dy09028kh/image/upload/v1719044607/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240622002305_tfbui5.png)

## Building Glibc v2.29 from Source

The first thing I checked was my Glibc version, and I found out that Ubuntu 16.04 uses Glibc version 2.23.

```bash
ldd --version | head -n1
```

I thought about building a newer version of Glibc from source and using it system-wide on Ubuntu 16.04, but I was worried it might break the OS functionality. After searching google for a bit, I found some Stack Overflow questions where people had similar issues. The advice was not to install it system-wide, but to install it in a separate path and make your binary use that Glibc version.

Building Glibc version 2.29 from source was quite easy by following the Stack Overflow answers.

```bash
wget -c https://ftp.gnu.org/gnu/glibc/glibc-2.29.tar.gz
tar -zxvf glibc-2.29.tar.gz
mkdir glibc-2.29/build
cd glibc-2.29/build
../configure --prefix=/opt/glibc
make 
make install
```

The script requires `gawk` and `bison` to be installed, so I installed the missing packages and continued the installation.

```bash
sudo apt install gawk bison

../configure --prefix=/opt/glibc
make 
make install
```

Now, Glibc version 2.29 was installed in the `/opt` directory alongside the default Glibc version, 2.23.


## Patching Node.js Binary using PatchELF

The next problem was how to use this newer version of Glibc with the Node.js v20 binary. I knew building Node.js from source would allow me to use a custom Glibc path, but I wanted a quicker fix. I found a post explaining how to use the [PatchELF](https://github.com/NixOS/patchelf) utility to modify the rpath and interpreter of an already compiled ELF.

:::tip
In Linux, every binary has an **interpreter** which it uses to run. You can see the interpreter a binary uses with the `file` command.

![file-whoami](https://res.cloudinary.com/dy09028kh/image/upload/v1719044671/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240621234510_z6m48w.png)

It means that whenever you run `whoami` command, behind the scenes, the command is processed like this

![behind-the-scenes](https://res.cloudinary.com/dy09028kh/image/upload/v1719044725/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240621234630_r75lzi.png)

The interpreter finds and loads the shared objects (libraries) needed by a program, prepares the program to run, and then runs it. More information can be found in the `ld.so` manual (`man ld.so`).

The **rpath** is the run-time search path hard-coded in an executable file or library. It is used by dynamic linking loaders to find required libraries.

We can also override a file interpreter, like running Python code files without prefixing `python` by adding `#!/usr/bin/python3` at the top of the file and giving it executable permission, similar to how we use `#!/bin/bash` in bash files.

You’ll find much more detail on this in the excellent [How programs get run: ELF binaries](https://lwn.net/Articles/631631/) article.
:::

To update the `node` binary's interpreter and rpath, we use the `patchelf` utility.

```bash
patchelf --set-interpreter /opt/glibc/lib/ld-linux-x86-64.so.2 --set-rpath /opt/glibc/lib/ ~/.nvm/versions/node/v20.14.0/bin/node
```

We can confirm the changes using the `file` command.

![confirm-file](https://res.cloudinary.com/dy09028kh/image/upload/v1719044777/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240622000724_h0ofg5.png)

When I checked the new Node.js binary, it gave an error about a missing library, likely because it wasn't in the new rpath location.

![missing-library](https://res.cloudinary.com/dy09028kh/image/upload/v1719044808/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240622000910_pc4lib.png)

To find all the shared objects a binary uses, we use the `ldd` command.

![ldd](https://res.cloudinary.com/dy09028kh/image/upload/v1719044848/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240622001302_vg2bjq.png)

We can create a symlink of the missing `libstdc++.so.6` library from `/usr/lib/x86_64-linux-gnu/` to our rpath folder, `/opt/glibc/lib/`. We repeat this process for any other missing libraries.

After fixing the missing library errors, we confirm the new locations of the shared objects with the `ldd` command.

![ldd-re](https://res.cloudinary.com/dy09028kh/image/upload/v1719044847/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240622002004_g5mzuc.png)

Now, our new Node.js binary is successfully patched and working.

![success](https://res.cloudinary.com/dy09028kh/image/upload/v1719044846/patching-nodejs-on-older-ubuntu-systems/Pasted_image_20240622002117_n4xsbc.png)

## References

> <https://stackoverflow.com/questions/72921215/getting-glibc-2-28-not-found>
> <https://stackoverflow.com/questions/72513993/how-to-install-glibc-2-29-or-higher-in-ubuntu-18-04>
> <https://stackoverflow.com/questions/847179/multiple-glibc-libraries-on-a-single-host>

## Closing Remarks

I hope this guide has been helpful for those facing similar challenges. There are always ways to improve, and I encourage you to try it yourself and share any suggestions in the comments section. Thanks for reading!

<br/>
<h2>Comments</h2>
<Giscus
id="comments"
repo="Noman-Aziz/Blogs"
repoId="R_kgDOIAF3tw"
category="General"
categoryId="DIC_kwDOIAF3t84CRfxZ"
mapping="title"
term="Comments"
reactionsEnabled="1"
emitMetadata="0"
inputPosition="top"
theme="preferred_color_scheme"
lang="en"
loading="lazy"
crossorigin="anonymous"
    />
