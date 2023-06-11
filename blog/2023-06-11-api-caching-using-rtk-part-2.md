---
slug: api-caching-using-rtk-part-2
title: Caching Your API Requests with RTK Query - Part 2 - Injecting Api Endpoints
author: NomanAziz
author_title: Full Stack Web3 Developer | DevSecOps Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz2.jpeg
image: https://res.cloudinary.com/dy09028kh/image/upload/v1684004825/Redux_Toolkit_vals3w.png
tags: [Javascript, RTK, RTK Query/Mutation]
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Giscus from "@giscus/react";

This is the part 2 of the RTK Query series. In this part, we'll dive into how to inject Query/Mutation API endpoints and integrate them into our code. If you haven't read part 1, i'll highly recommend you to check it out [here](https://blog.nomanaziz.me/api-caching-using-rtk-part-1)

<!--truncate-->

## Injecting Endpoints in ApiBase

If you look at previous part, while creating our ApiBase controller, we left the `endpoints` field empty. Now, we will manually inject all the endpoints what we want

Suppose, we have two apis, one for creating order and second for getting all orders our code will look something like this

```js
export const orderAPI = ApiBase.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query({
      query: (query) => ({
        url: `/api/v1/order/getAll?${query}`,
        method: 'GET',
      }),
    }),
    createOrder: builder.mutation({
      query: (data) => ({
        url: `/api/v1/order/create`,
        method: 'POST',
        body: data,
      }),
    }),
  })
})

export const {
  useGetOrdersQuery,
  useCreateOrderMutation,
} = orderAPI;
```

Basically, we use `injectEndpoints` function from ApiBase to create our endpoints. `query` is used for requests that retrieve data while `mutation` is used to send data updates to the server and apply the changes to the local cache.


We can use them in our components like this,

### Query Hook

```js
const { data, refetch, isFetching } = useGetOrdersQuery(`page=1&limit=10`);
```

There are many [return values](https://redux-toolkit.js.org/rtk-query/usage/queries#frequently-used-query-hook-return-values) from the Query hook. The `data` object will contain our api response, `refetch` function allows us to force refetch the data from the server. `isFetching` indicates that our query is currently fetching, this is useful for providing loader UI in our components. 

### Mutation Hook

```js
const [createOrder, result] = useCreateOrderMutation();

const handler = (orderDetail) => {
    createOrder({ data: orderDetail })

    // other code
}
```

Unlike Query hook, Mutation hook returns a tuple. First item is the api trigger function and second contains an object which have [return values](https://redux-toolkit.js.org/rtk-query/usage/mutations#frequently-used-mutation-hook-return-values) 

:::tip
While defining our api endpoints, we can use [certain parameters](https://redux-toolkit.js.org/rtk-query/usage/queries#defining-query-endpoints) like `transformResponse` and `onQueryStarted` to perform certain actions like

```js
export const orderAPI = ApiBase.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query({
      query: (query) => ({
        url: `/api/v1/order/getAll?${query}`,
        method: 'GET',
      }),
      transformResponse: (response) => response.notifications,
    }),
    deleteOrder: builder.mutation({
      query: (id) => ({
        url: `/api/v1/order/${id}`,
        method: 'DELETE',
      }),
      async onQueryStarted(query, { queryFulfilled, dispatch }) {
        try {
          dispatch(
            addMessage({
              message: 'Deleting...',
              type: 'info',
            })
          );

          await queryFulfilled;

          dispatch(
            addMessage({
              message: 'Delete successful',
              type: 'success',
            })
          );
        } catch (error) {
          dispatch(
            addMessage({
              message: error?.error?.data?.message || error.message || 'Delete failed',
              type: 'error',
            })
          );
        }
      },
    }),
  })
})
```

In the above code, we basically first transformed the response object to return only data to the component where this hook will be called and in the delete api, we dispatch some toast messages to our message slice of redux store.
:::

## Automated Re-fetching using Tags

Suppose, you want to automatically fetch all updated orders whenever you create or delete an order. RTK Query uses a [cache tag](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching) system to automate re-fetching for query endpoints that have data affected by mutation endpoints.

We will apply [providesTags](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching#providing-cache-data) property on our `getOrders` query and later on invalidate it using [invalidatesTags](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching#invalidating-cache-data) property on our mutation endpoints i.e `createOrder` and `deleteOrder`.

```js
export const orderAPI = ApiBase.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query({
      query: (query) => ({
        url: `/api/v1/order/getAll?${query}`,
        method: 'GET',
      }),
      providesTags: ['Orders'],
    }),
    createOrder: builder.mutation({
      query: (data) => ({
        url: `/api/v1/order/create`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Orders'],
    }),
    deleteOrder: builder.mutation({
      query: (id) => ({
        url: `/api/v1/order/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Orders'],
    }),    
  })
})
```

So, we have applied `Orders` tag to our specific query endpoint. When mutation endpoints are fired, they will invalidate the Orders tag, the cached data will be considered invalidated, and re-fetch since there is an active subscription to the cached data.

## Closing remarks

This wraps up our RTK Query series. I hope this series has been helpful for using RTK Query in your application. There are many things that can be improved here. I encourage you to try out ourself and leave some suggestions in the comments section. Thanks for reading!


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
