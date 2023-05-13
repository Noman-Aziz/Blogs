---
slug: api-caching-using-rtk-part-1
title: Caching Your API Requests with RTK Query - Part 1 - Setting up Store & ApiBase
author: NomanAziz
author_title: Full Stack Web3 Developer | DevSecOps Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz2.jpeg
image: https://res.cloudinary.com/dy09028kh/image/upload/v1684004825/Redux_Toolkit_vals3w.png
tags: [Javascript, RTK, RTK Query/Mutation]
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Giscus from "@giscus/react";

As a developer, if you've used React before, you might have relied on `useState` or `useEffect` hooks to fetch data from APIs and then stored that data in a Redux store for state management. While this approach may work well for small projects, it can quickly become inefficient and lead to performance issues when building larger-scale web applications. That's where `Redux Toolkit Query` comes in to simplify your API calls and help you focus on building great user experiences.

<!--truncate-->

## RTK Query

RTK Query is an optional add-on in the Redux Toolkit package that simplifies data fetching and caching. It is built on top of the other APIs in Redux Toolkit and leverages RTK's APIs like `createSlice` and `createAsyncThunk` to implement its capabilities. Developers typically use async middleware modules like Thunk for API interaction when working with Redux. RTK Query allows developers to create a slice to handle fetch requests, similar to React Query but with the benefit of being directly integrated with Redux

## Setting up ApiBase

We need a few things to setup before the redux store. First, we will create an API client using the `createApi` function provided by RTK Query. It accepts an object with parameters like 
- `baseQuery` which accepts a function which is used as a middleware for all outgoing API requests.
- `reducerPath` specifies the name of the slice of the Redux store where the API state will be stored.
- `endpoints` accepts a function that returns an object containing all of the endpoints for the API. 

Our code will look something like this

```js
const ApiBase = createApi({
  baseQuery: baseQueryWithReAuth, // More on this below
  reducerPath: 'API',
  endpoints: () => ({}), // We would inject endpoints later on
});
```

Our `baseQueryWithReAuth` function is a wrapper around `fetchBaseQuery` package from RTK Query, it handles api authentication and re-authentication using `mutex` (yes mutex, you heard it right). When this function is called, it first waits for the mutex to be available (i.e. not locked) before executing the baseQuery function. If the response from baseQuery contains an error with a status code of `401` (Unauthorized - handled from backend for unauthenticated requests), it indicates that the user's access token is no longer valid. In this case, the mutex is acquired and the user is logged out, after which the mutex is released.

Furthermore, if the mutex is already locked, it waits for the mutex to become available before trying the request again. This is to prevent multiple concurrent requests from triggering multiple re-authentication attempts, which could cause issues. 

```js
const baseQueryWithReAuth = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions); // More on this function below

  if (result.error && result.error.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        api.dispatch(logout()); // Logout the user
      } catch (e) {
        console.log(e); // Any unexpected error is handled here
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }
  return result;
};
```

Finally `baseQuery` is a wrapper around `fetchBaseQuery` package from RTK Query. The `baseUrl` option is the API's base URL. The `prepareHeaders` option is a function that intercepts outgoing requests and allows for modifying or adding headers, such as authentication tokens.

```js
const baseQuery = fetchBaseQuery({
  baseUrl: config.baseUrl,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().user.token; // We will get this from our user slice

    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }

    return headers;
  },
});
```

## Setting up Redux Store

Now that we have setup our API base, we will create our Redux store, first we will use `combineReducers` function from RTK to combine our normal slice reducers and also our `ApiBase reducer` which is generated reducer object when we pass or inject `endpoints`. This reducer object has a number of internal reducers that manage state for each of the endpoints that we define in the endpoints object.

```js
const rootReducer = combineReducers({
  user: authSlice,
  ApiBase.reducerPath: ApiBase.reducer,
});
```

Now we will create our store as we would normally do and add `ApiBase.middleware` which listens for RTK Query's generated action types and automatically dispatches the appropriate actions. It also handles caching, invalidation, and other features of RTK Query.

```js
export const store = configureStore({
  reducer: rootReducer,
  middleware: [ApiBase.middleware],
  devTools: process.env.NODE_ENV !== 'production',
});
```

:::tip
### Setup Encrypted & Persisted Store

We can use `redux-persist` and `redux-persist-transform-encrypt` packages to persist our specified (`whitelist`) store slices and store them in an encrypted state, your store will look something like this

```js
const rootReducer = combineReducers({
  user: authSlice,
  [ApiBase.reducerPath]: ApiBase.reducer,
});

const secretKey =
  process.env.REACT_APP_SECRET_KEY ||
  'my-super-secret-key-which-is-very-long-so-that-it-will-be-hard-for-anyone-to-guess-it';

const persistConfig = {
  key: 'Our-App',
  version: 1,
  storage,
  whitelist: [
    'user',
  ],
  transforms: [
    encryptTransform({
      secretKey,
      onError: (error) => {
        console.error(error);
      },
    }),
  ],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(ApiBase.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persister = persistStore(store);
```

The `getDefaultMiddleware` function returns an array of default middlewares that are provided by redux-toolkit. By default, the `serializableCheck` middleware is included in this array which ensures that actions dispatched to the store are serializable. It works by checking if the action is serializable or not and throws an error if it is not. `ignoredActions` which takes an array of actions that should be ignored by the serialization check. In the code above, mentioned ignoredActions are all coming from redux-persist package.
:::

## Closing remarks

This wraps up part 1 of our RTK Query series. I hope this guide has been helpful in setting up the basics for using RTK Query in your application. In part 2, we'll dive into how to inject Query/Mutation API endpoints and integrate them into our code. In the meantime, I encourage you to try out RTK Query in your own projects and share your experiences in the comments below. Thanks for reading!

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
