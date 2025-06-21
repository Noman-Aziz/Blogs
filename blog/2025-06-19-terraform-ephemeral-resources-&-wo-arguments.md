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

Recently I was working with Terraform when I wanted to create a resource that required a password to be provided to it. Normally, we might either supply the password from the vault via data resource or pass it via a variable at runtime in CI, but that got me thinking that if the main purpose is to avoid hardcoding secrets, the state file will still contain the password in plain text nonetheless.

That led me to finding out about ephemeral resources and the write-only arguments feature in Terraform. Not only can you create random secrets or provide secrets to resources, but you can also update them without them being stored in a state file.

<!--truncate-->

## Ephemeral Resources

This feature was introduced in Terraform version 1.10, which provided ephemeral input and output variables and ephemeral resources support.

:::tip
You can read HashiCorp's announcement [blog](https://www.hashicorp.com/en/blog/terraform-1-10-improves-handling-secrets-in-state-with-ephemeral-values) for version 1.10 to get to know more about this.
:::

Let's take this example in which you have to supply credentials from AWS Secrets Manager via data block to the Postgres provider. Normally you would do something like this:

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

This would cause the data block resource along with its contents to be stored in the state file, therefore exposing the secret value like this:

<INSERT_PIC_1>

But let's now take a look at how we can supplement ephemeral resources to do the same thing.

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

Now analyzing the state file, we can see that it doesn't store the ephemeral resources block; hence, our secret is not exposed.

<INSERT_PIC_2>

## Write Only Arguments

This feature was introduced in Terraform version 1.11, which solved the problem of lacking ephemeral resources. Suppose you initialize the secret at runtime via a variable, but you have to provide it in a resource instead of a provider. When you provide the secret in the resource, its value gets stored in a state file, like in the example below.

```tf
variable "db_password" {
  sensitive = true
}

resource "aws_db_instance" "test" {
  instance_class      = "db.t4g.micro"
  allocated_storage   = "5"
  engine              = "postgres"
  username            = "db_master_user"
  password            = var.db_password
}
```

<INSERT_PIC_3>

Although the variable's value didn't get stored, the aws_db_instance resource stored the password for state comparison. With the write-only attribute, you can provide the password, but it will not get stored in the state file.

But how would Terraform know that the password was changed if it has nothing to compare it to? To solve it, Terraform provides a write-only version attribute that triggers the password change.

:::tip
You can read HashiCorp's announcement for version 1.11 on the [blog](https://www.hashicorp.com/en/blog/terraform-1-11-ephemeral-values-managed-resources-write-only-arguments) to get to know more about this.
:::

Let's take the above example again.

```tf
variable "db_password" {
  ephemeral = true
}

resource "aws_db_instance" "test" {
  instance_class      = "db.t4g.micro"
  allocated_storage   = "5"
  engine              = "postgres"
  username            = "db_master_user"
  password_wo         = var.db_password
  password_wo_version = 1
}
```

We have now replaced password with the write-only (wo) argument and specified its version as 1. You can see in the state file that it doesn't contain the password value, but only the version.

<INSERT_PIC_4>

Whenever we want to rotate the password, we can change the `password_wo_version` parameter, which will cause the random_password to regenerate and update the DB instance password.

Here is the `terraform plan` output when I provide different values to the `db_password` variable.

<INSERT_PIC_5>

You can see that it didn't show any change since it's not comparing the password value. But look at when I bump the `password_wo_version` to 2 and provide the same password.

<INSERT_PIC_6>

You can see that it shows to modify the password since it is comparing the version, not the value.

## The Caveat

Well, you may think that this solution will work for every resource, but unfortunately, due to it being a relatively new feature, it is not supported in every AWS resource and its wrapper modules, like the community-beloved [terraform-aws-modules](https://registry.terraform.io/modules/terraform-aws-modules/).

## The Solution

To solve this, I came up with the idea of updating after creating. This basically means that upon creation of the resource, you provide a dummy password and then update the password with an ephemeral one using a null resource block using CLI commands inside the `local-exec` block.

Since this is a custom solution, it may seem a bit hacky. But you basically delegate the password handling functionality from resource to null block. Similarly to the write-only version argument, you can set the trigger of the null resource block to a version, and when you modify the version, the null resource block will retrigger and modify the password.

Below is an example where an AWS Elasticache user is created with a dummy password but then updated with a randomly generated ephemeral password using a null resource `local-exec` block.

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

As you can see, not only are we updating the ElastiCache user password, but also storing it in the SSM Parameter Store for later use in applications. Whenever you want to rotate the password, just modify the `password_version` variable.

## Closing Remarks

There are many useful use cases for this feature, like setting up a free secret storage Git repo using AWS Parameter Store and Terraform, in which the secrets are created/modified/deleted via GitHub Actions pipeline, but the values are ephemeral. Maybe I'll write a blog about it someday, but I encourage you to try out various things and share any suggestions in the comments section. Thanks for reading!

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
