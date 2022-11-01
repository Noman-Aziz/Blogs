---
title: Auto-renew self-signed OpenSSL certificates
---

### Problem

So you have generated self-signed certificates using OpenSSL and you want it to automatically renew once its expiry date is less than 30 days!

### Solution

You can use the following bash script and place it inside ```crontab``` which runs once every day to accomplish the above problem.

```sh
#!/bin/bash

location=$1
crt_loc="$location/certificate.crt"
key_loc="$location/key.key"

# 30 days is default on warnings - overridden on command line with '-d':
days_to_warn=30
epoch_day=86400
epoch_warning=$((days_to_warn*epoch_day))

today_epoch="$(date +%s)"

expire_date=$(openssl x509 -noout -dates -in $crt_loc | awk -F= '/^notAfter/ { print $2; exit }')
expire_epoch=$(date +%s -d "$expire_date")

timeleft=`expr $expire_epoch - $today_epoch`

if [[ $timeleft -le $epoch_warning ]]; then #RENEW
   generate_new=$(openssl req -new -newkey rsa:4096 -x509 -sha256 -days 365 -nodes -out /tmp/new_certificate.crt -keyout /tmp/new_key.key -subj "/C=PK/ST=XYZ/L=XYZ/O=XYZ/OU=XYZ/CN=XYZ")
   sudo mv /tmp/new_certificate.crt $crt_loc
   sudo mv /tmp/new_key.key $key_loc
else
   echo "NOT EXPIRED"
fi
```

This script accepts the folder path which contains certificates (certificate.crt & key.key) files and then performs various expiry checks if expired, it generates new certificates and overwrites the previous ones at the given location.

### References

- <a href="https://stackoverflow.com/questions/11947295/how-to-generate-openssl-certificate-with-expiry-less-than-one-day" target="_blank"> https://stackoverflow.com/questions/11947295/how-to-generate-openssl-certificate-with-expiry-less-than-one-day</a>
- <a href="https://gist.github.com/bmatthewshea/2f4301b769a46e7eb10d554a52a864b3" target="_blank"> https://gist.github.com/bmatthewshea/2f4301b769a46e7eb10d554a52a864b3</a>