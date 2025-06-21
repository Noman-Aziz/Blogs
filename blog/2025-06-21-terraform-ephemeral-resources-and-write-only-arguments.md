---
slug: terraform-ephemeral-resources-and-write-only-arguments
title: Avoiding Secrets Exposure in Terraform State File Using Ephemeral Resources & Write-Only Arguments
author: NomanAziz
author_title: Security Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz3.jpeg
image: https://res.cloudinary.com/dy09028kh/image/upload/v1750504180/terraform-ephemeral-resources-and-write-only-arguments/byahajqadwfiwi6ukhss.jpg
tags: [Terraform, IaC, Ephemeral, Write-Only, DevSecOps, AWS]
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Giscus from "@giscus/react";

Recently, I was working with Terraform and wanted to create a resource that required a password. Normally, we would either supply the password from the vault via data resource or pass it via a variable at runtime in CI, but this got me thinking that if the primary goal is to avoid hardcoding secrets, the state file will still contain the password in plain text.

That led me to learn about ephemeral resources and Terraform's write-only arguments feature. Not only can you generate random secrets or provide secrets to resources, but you can also update them without storing them in the state file.

<!--truncate-->

## Ephemeral Resources

This feature was introduced in Terraform version 1.10, which provided ephemeral input and output variables and ephemeral resources support.

:::tip
You can read HashiCorp's announcement [blog](https://www.hashicorp.com/en/blog/terraform-1-10-improves-handling-secrets-in-state-with-ephemeral-values) for version 1.10 to get to know more about this.
:::

Let's take this example in which you have to supply credentials from AWS Secrets Manager via data block to the Postgres provider. Normally you would do something like this.

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

This would cause the data block resource along with its contents to be stored in the state file, therefore exposing the secret value like this.

![data-block](https://res.cloudinary.com/dy09028kh/image/upload/v1750503203/terraform-ephemeral-resources-and-write-only-arguments/tp9z2khgzdkas25hwlko.png)

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

![ephemeral-data-block](https://res.cloudinary.com/dy09028kh/image/upload/v1750503203/terraform-ephemeral-resources-and-write-only-arguments/udrmbeqwobkmxbit6dbl.png)

## Write-Only Arguments

These were introduced in Terraform version 1.11, addressing a critical feature that was lacking in ephemeral resources. Suppose you initialize the secret at runtime via a variable, but you have to provide it in a resource instead of a provider. When you provide the secret in the resource, its value gets stored in a state file, like in the example below.

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

![normal-resource](https://res.cloudinary.com/dy09028kh/image/upload/v1750503203/terraform-ephemeral-resources-and-write-only-arguments/ngwozkogf8py3ailxlzw.png)

Although the variable's value didn't get stored, the `aws_db_instance` resource stored the password for state comparison. With the write-only attribute, you can provide the password, but it will not get stored in the state file.

But how would Terraform know that the password was changed if it has nothing to compare it to? To solve it, Terraform provides a write-only version attribute that triggers the password change.

:::tip
You can read HashiCorp's announcement [blog](https://www.hashicorp.com/en/blog/terraform-1-11-ephemeral-values-managed-resources-write-only-arguments) for version 1.11 to get to know more about this.
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

![write-only-argument](https://res.cloudinary.com/dy09028kh/image/upload/v1750503203/terraform-ephemeral-resources-and-write-only-arguments/mbqh4frllemsy8evezux.png)

Whenever we want to rotate the password, we can change the `password_wo_version` parameter, which will cause the random_password to regenerate and update the DB instance password.

Here is the `terraform plan` output when I provide different values to the `db_password` variable.

![same-version](https://res.cloudinary.com/dy09028kh/image/upload/v1750503203/terraform-ephemeral-resources-and-write-only-arguments/cnrwmnlzm5sbl1zqbupv.png)

You can see that it didn't show any change since it's not comparing the password value. But look at when I bump the `password_wo_version` to 2 and provide the same password.

![different-version](https://res.cloudinary.com/dy09028kh/image/upload/v1750503203/terraform-ephemeral-resources-and-write-only-arguments/x5eb9kwp45lvcwthbuub.png)

You can see that it shows to modify the password since it is comparing the version, not the value.

## The Caveat

Well, you may think that this solution will work for every resource, but unfortunately, due to it being a relatively new feature, it is not supported in every AWS resource and its wrapper modules, like the community-beloved [terraform-aws-modules](https://registry.terraform.io/modules/terraform-aws-modules/).

## The Solution

To solve this, I came up with the idea of updating after creating. This basically means that upon creation of the resource, you provide a dummy password and then update the password with an ephemeral one using a null resource block and CLI commands inside the `local-exec` block.

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
        --authentication-mode Type=password,Passwords="${ephemeral.random_password.user_password.result}" \
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
  value_wo         = ephemeral.random_password.user_password.result
  value_wo_version = local.password_version
}
```

As you can see, not only are we updating the ElastiCache user password, but also storing it in the SSM Parameter Store for later use in applications. Whenever you want to rotate the password, just modify the `password_version` variable.

## Closing Remarks

There are numerous applications for this feature, such as creating a free secret storage Git repo using AWS Parameter Store and Terraform, in which the secrets are created/modified/deleted via GitHub Actions pipeline, but the values are ephemeral. Maybe I'll write a blog about it someday, but I encourage you to experiment and share your ideas in the comments section. Thank you for reading.

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
