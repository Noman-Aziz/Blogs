---
slug: api-caching-using-redux-toolkit
title: Api data caching using RTK Query
author: NomanAziz
author_title: Full Stack Web3 Developer | DevSecOps Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz2.jpeg
image: https://res.cloudinary.com/dy09028kh/image/upload/v1664541995/1640019487-og-image_hwzsle.png
tags: [Javascript, RTK, RTK Query/Mutation]
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Giscus from "@giscus/react";

If you use React like me, you may use `useState` or `useEffect` hooks to fetch data from APIs and then store some data in Redux store for state management. While this approach is great when you start learning React, it is not efficient for building large scale web apps since it degrades the performance and user experience. That is where Redux Toolkit Query comes in place. 

RTK Query is an optional add-on in the Redux Toolkit package that simplifies data fetching and caching. It is built on top of the other APIs in Redux Toolkit and leverages RTK's APIs like `createSlice` and `createAsyncThunk` to implement its capabilities. Developers typically use async middleware modules like Thunk for API interaction when working with Redux. RTK Query allows developers to create a slice to handle fetch requests, similar to React Query but with the benefit of being directly integrated with Redux

<!--truncate-->

## Redux

In Terraform, a provider is a plugin that allows us to talk to a set of APIs. For instance, to interact with AWS, we have to download the AWS provider, similarly, to interact with Kubernetes, we have to download the Kubernetes provider. Refer to [terraform docs](https://registry.terraform.io/browse/providers) to take a look at all available providers.

Below is the sample code to define an AWS provider, note that this is not the recommended way to set up an AWS provider since we have hard-coded the access key and secret key in our file.

## Closing remarks

It takes some time to get used to this approach, but if you setup the base of the project like this, you will save all the effort later. I am open to any suggestions in the comments section, thank you for taking time to read my article.

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
