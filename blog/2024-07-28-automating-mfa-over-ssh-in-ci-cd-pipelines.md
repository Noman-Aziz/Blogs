---
slug: automating-mfa-over-ssh-in-ci-cd-pipelines
title: Automating MFA over SSH in CI/CD Pipelines
author: NomanAziz
author_title: Security Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz3.jpeg
image: https://res.cloudinary.com/dy09028kh/image/upload/v1722106923/ed-hardie-RMIsZlv8qv4-unsplash_o9gnnn.jpg
tags: [SSH, MFA, Expect, DevOps, Automation]
---

You might have heard of the trade-off between security and usability. It's true that a computer without a password is usable but not very secure. On the other hand, a computer that makes you re-authenticate every 5 minutes with a password and TOTP code may be secure but not very usable.

I faced a similar situation. I was tasked with configuring SSH to use Multi-Factor Authentication (MFA). While this was relatively straightforward, the real challenge was automating it in CI/CD pipelines that relied on SSH to access the target server.

## MFA Security Controls

To secure the instance, I used three types of SSH authentication controls:

1. Password-Based Authentication
2. Password-Protected Private Key-Based Authentication
3. TOTP-Based Authentication

:::tip
To configure SSH to use two-factor authentication on an Ubuntu server, follow this well-made [tutorial](https://ubuntu.com/tutorials/configure-ssh-2fa).
:::

While the [sshpass](https://linux.die.net/man/1/sshpass) utility may seem useful for automation scripts, it cannot handle other types of authentication mechanisms in SSH.

## OATH Toolkit

When setting up TOTP-based MFA on a Linux server via utilities such as `libpam-google-authenticator`, you will get a **secret key**. This is the main component to generate TOTP tokens. We can use utilities such as [OATHTOOL](https://www.nongnu.org/oath-toolkit/oathtool.1.html) to generate a TOTP code from a secret key. This is the first key in our automation.

## Expect

The second main component in our automation is the [Expect](https://linux.die.net/man/1/expect) program. We can create a script that interacts with other programs, sending responses based on predefined prompts. Additionally, a user can take control and interact directly with the program when desired.

## The Automation

Now that we have analyzed the tools we need, we can write an Expect script that utilizes OATHTOOL to automatically SSH into a server with MFA configured.

First, we need to manually analyze the input prompts. Let's take the example of a server where I have previously implemented MFA security controls.

```bash
➜  ~ ssh -i ~/.ssh/id_ed25519 ubuntu@172.19.49.42
Enter passphrase for key './id_ed25519':
(ubuntu@172.19.49.42) Password:
(ubuntu@172.19.49.42) Verification code:
```

You can see that after providing the private key, it asks for the passphrase for the private key, the password for the Ubuntu server instance, and finally the TOTP authentication code.

Hence, our Expect script for SSH will look like this:

```expect
#!/usr/bin/env expect

set USER [lindex $argv 0]
set PASSWORD [lindex $argv 1]
set PASSPHRASE [lindex $argv 2]
set HOST [lindex $argv 3]
set PORT [lindex $argv 4]
set MFA_SECRET_KEY [lindex $argv 5]
set PRIVATE_KEY_PATH [lindex $argv 6]

spawn ssh -i $PRIVATE_KEY_PATH $USER@$HOST -p $PORT

expect "*?assphrase*"
send -- "$PASSPHRASE\r"

expect "*?assword:*"
send -- "$PASSWORD\r"

# Generate the Google Authenticator code
set OTP_CODE [exec oathtool --base32 --totp $MFA_SECRET_KEY]

expect "*?ode:*"
send -- "$OTP_CODE\r"

send -- "\r"
interact
```

In the script, we first accept all the input parameters as command line arguments. Then we use the `spawn` keyword to execute our SSH command. We use regex to check input prompts as identified before using the `expect` keyword and enter respective inputs using the `send` keyword. `\r` is a carriage return used to simulate pressing Enter. Finally, the `interact` keyword hands over control of SSH at the end.

While this seems like a standalone script for automation, we can modify it slightly for use in CI/CD pipelines by removing the `interact` keyword and specifying the workflow command directly in the SSH input. Additionally, we should store all sensitive variables like `MFA_SECRET_KEY`, `PASSPHRASE`, etc., in a secrets manager like GitHub Secrets for GitHub Actions.

```expect
#!/usr/bin/env expect

...

spawn ssh -i $PRIVATE_KEY_PATH $USER@$HOST -p $PORT "$COMMAND"

...

expect eof
```

Similarly, the script can be slightly modified for the scp command:

```expect
#!/usr/bin/env expect

...

spawn scp -i $PRIVATE_KEY_PATH -P $PORT $LOCAL_PATH $USER@$HOST:$REMOTE_PATH

...

expect eof
```

When running automation scripts using the Expect utility, you may encounter situations where your program exits before completion, especially when something takes time and no output is shown on the screen before completion. In these scenarios, you can set an infinite timeout using `set timeout -1` in your script.

## Closing Remarks
I hope this guide has been helpful for those trying to automate tasks while enhancing security controls. There are always ways to improve, and I encourage you to try it yourself and share any suggestions in the comments section. Thanks for reading!

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
