# disposable-pool

[![Build Status](https://travis-ci.org/s-lyn/disposable-pool.svg?branch=master)](https://travis-ci.org/s-lyn/disposable-pool)

Easy-to-use pool of any disposable clients.
Used to warm up the long-term actions. Note that once a client was acquired
from pool, it leave it forever.


## Installation

```bash
npm i s-lyn/disposable-pool
```

## Usage

**new DisposablePool(*options*)**

```js
const DisposablePool = require('disposable-pool')

const pool = new DisposablePool({
  create: async () {
    // Crete and return your client
    return { your: 'client object here' }
  },
  onRemove: async (client) {
    console.log('Removed client:', client)
  },
  max: 3,
  idleTimeoutMillis: 60000,
  getTimeoutMillis: 15000
})
pool.on('error', err => {
  // Handle errors
})

async function main () {
  // Get clients
  const client = await pool.get()
  const client2 = await pool.get()
  // ...
}
main().catch(console.error)
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| create* | {Function} | Sync or async factory function. Should return new object or `NULL` when created client is not valid |
| onRemove | {Function} | Sync or async function on remove client. Will be executed  only after idle timeout or destroy. Acquired client leave the pool forever and do not execute `onRemove` |
| max | {Number} | Max size of pool. Default: 1 |
| idleTimeoutMillis | {Number} | The minimum amount of time that an object may sit idle in the pool before it is eligible for eviction due to idle timeout. Default: 0 |
| getTimeoutMillis | {Number} | The minimun amount of time that #get() method will wait for the ready client. Default: 30000 |


### Methods and params

#### #get(*{timeout}*)

Get client from pool. If no any client in the pool it will wait for.

| Param | Type | Description |
|-------|------|-------------|
| timeout | {Number} | Get timeout in milliseconds. If this time has elapsed, then `#get()` returns `undefined` |

Returns: `Promise<client>`

Example:

```js
const client = await pool.get()
```

#### #destroy()

Stop to create new clients and remove all existing in the pool.
Executes the `onRemove` function if set.

This method do not recieve any options.

Returns: `Promise<undefined>`

Example:

```js
await pool.destroy()
```

#### size

Retuens the number of clients in pool (ready or not).

Returns: `{Number}`

Example:

```js
console.log(pool.size)
```


### Events

Class `DisposablePool` extends `EventEmitter` and can emit events:

#### error

Errors in `create` and `onRemove` functions. You should specify the listener
for this event to prevent `UnhandledPromiseRejectionWarning`

Example:

```js
pool.on('error', err => {
  // Handle errors
})
```

## Tests

To run unit tests run:

```bash
npm test
```
