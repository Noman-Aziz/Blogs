---
slug: terraform-ephemeral-resources-&-wo-arguments
title: Avoiding Secrets Exposure in Terraform State File using Ephemeral Resources & Write-Only Arguments
author: NomanAziz
author_title: Security Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz3.jpeg
image: https://res.cloudinary.com/dy09028kh/image/upload/v1722106923/ed-hardie-RMIsZlv8qv4-unsplash_o9gnnn.jpg
tags: [Terraform, IaC, Ephemeral, Write-Only, DevSecOps, AWS]
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Giscus from "@giscus/react";

Recently i was working with terraform when i wanted to create a resource which required password to be provided to it. Normally, we might either supply password from vault via data resource or pass it via a variable on runtime in CI, but that got me thinking that if the main purpose is to avoid hardcoding secrets, the state file will still contain the password in plain text, even if it is stored encryptedly in a remote backend like S3.

That led me to finding about ephemeral resources and write only arguments feature in terraform. Not only you can create random secrets or provide secrets to resources, you can also update them without them being stored in state file.

<!--truncate-->

## Ephemeral Resources

This feature was introduced in terraform version 1.10 which provided ephemeral input and output variables and ephemeral resources support.

:::tip
You can read hashicorp's [blog](https://www.hashicorp.com/en/blog/terraform-1-10-improves-handling-secrets-in-state-with-ephemeral-values) to get to know more about this.
:::

Lets take this example in which you've to supply credentials from aws secrets manager via data block to postgres provider. Normally you would do something like this

```tf
data "aws_secretsmanager_secret_version" "db_username" {
  secret_id = <DB_USERNAME_SECRET_ARN>
}

data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = <DB_PASSWORD_SECRET_ARN>
}

provider "postgresql" {
  host     = data.aws_db_instance.example.address
  port     = data.aws_db_instance.example.port
  username = data.aws_secretsmanager_secret.db_username.secret_string
  password = data.aws_secretsmanager_secret.db_password.secret_string
}
```

This would cause the data block contents to be stored in state file like this

<INSERT_PIC>

But lets now take a look at how we can supplement ephemeral resource to do the same thing

```tf
ephemeral "aws_secretsmanager_secret_version" "db_username" {
  secret_id = <DB_USERNAME_SECRET_ARN>
}

ephemeral "aws_secretsmanager_secret_version" "db_password" {
  secret_id = <DB_PASSWORD_SECRET_ARN>
}

provider "postgresql" {
  host     = data.aws_db_instance.example.address
  port     = data.aws_db_instance.example.port
  username = ephemeral.aws_secretsmanager_secret.db_username.secret_string
  password = ephemeral.aws_secretsmanager_secret.db_password.secret_string
}
```

Now analyzing the state file, we can see that the data block contents are redacted

<INSERT_PIC>

## Write Only Arguments

This feature was introduced in terraform version 1.11 which solved the problem lacking in ephemeral resources. Suppose you have fetched ephemeral secrets like in previous example, but you have to provide the secrets in a resource instead of provider. When you provide a value in resource even from ephemeral data block, the value gets stored in state file like in the example below.

```tf
ephemeral "random_password" "db_password"{
  length = 16
}

resource "aws_db_instance" "test" {
  instance_class      = "db.t3.micro"
  allocated_storage   = "5"
  engine              = "postgres"
  username            = "db_master_user"
  password            = ephemeral.random_password.db_password
}
```

<INSERT_PIC>

Although the generated random password didn't get stored, the aws_db_instance resource stored the password for state comparison. With write only attribute, you can provide the password, but it will not get stored in state file.

But how would terraform know that the password was changed, if it has nothing to compare it to. To solve it, terraform provides write only version attribute which triggers the password change.

:::tip
You can read hashicorp's [blog](https://www.hashicorp.com/en/blog/terraform-1-11-ephemeral-values-managed-resources-write-only-arguments) to get to know more about this.
:::

Lets take the above example again,

```tf
ephemeral "random_password" "db_password"{
  length = 16
}

resource "aws_db_instance" "test" {
  instance_class      = "db.t3.micro"
  allocated_storage   = "5"
  engine              = "postgres"
  username            = "db_master_user"
  password_wo         = ephemeral.random_password.db_password
  password_wo_version = 1
}
```

We have now replaced password with write only (wo) argument and specified its version with 1. Whenever we want to rotate the password, we can change the `password_wo_version` parameter which will cause the random_password to regenerate and update the db instance password. You can see in the state file that it doesn't contain the password value.

<INSERT_PIC>

## The Caveat

Well, you may think that this solution will work for every resource, but unfortunately due to it being relatively new feature, it is not supported in every aws resource and its wrapper modules like the community beloved [terraform-aws-modules](https://registry.terraform.io/modules/terraform-aws-modules/).

## The Solution

To solve this, i came up with the idea of update after create. This basically means that upon creation of the resource, you provide a dummy password and then update the password with an ephemeral one using null resource block using cli commands inside `local-exec` block.

Since this is a custom solution, it may seems a bit hacky. But you basically delegate the password handling functionality from resource to null block. Similarly to the write only version argument, you can set the trigger of null resource block to a version and when you modify the version, null resource block will retrigger and modify the password.

Below is an example where aws elasticache user is created with dummy password, but then updated with randomly generated ephemeral password using null resource `local-exec` block.

```tf
resource "aws_elasticache_user" "test_user" {
  user_id              = "test-user"
  user_name            = "test"
  engine               = "valkey"
  passwords            = ["SuperGenericPasswordWillBeChanged"]
  access_string        = "on ~test::* resetchannels -@all +@read +@write +ping +quit"
  no_password_required = false

  timeouts {
    create = "15m"
    update = "15m"
  }
}

ephemeral "random_password" "user_password" {
  length = 16
}

resource "null_resource" "set_user_password" {
  depends_on = [aws_elasticache_user.test_user]

  provisioner "local-exec" {
    command = <<EOT
      aws elasticache modify-user \
        --user-id test-user \
        --authentication-mode Type=password,Passwords="${ephemeral.random_password.user_password}" \
        --region "us-east-1"
    EOT
  }

  triggers = {
    version = local.password_version
  }
}

resource "aws_ssm_parameter" "user_ssm_password" {
  depends_on = [null_resource.set_user_passwords]

  name             = "/elasticache_user_password"
  type             = "SecureString"
  value_wo         = ephemeral.random_password.user_password
  value_wo_version = local.password_version
}
```

As you can see, not only are updating the elasticache user password, but also storing it in ssm parameter store for later use in applications. Whenever you want to rotate the password, just modify the `password_version` variable.

## Closing Remarks

There are many useful usecases for this feature. You can setup a free secret storage git repo using aws parameter store and terraform in which the secrets are created/modified/deleted via github actions pipeline, but the values are ephemeral. Maybe i'll write a blog about it someday. I encourage you to try out various things and share any suggestions in the comments section. Thanks for reading!

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
