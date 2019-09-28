const { EventEmitter } = require('events')

class DisposablePool extends EventEmitter {
  constructor (options = {}) {
    super()
    const optionsKeys = Object.keys(options)
    const allowedOptions = [
      'create',
      'max',
      'idleTimeoutMillis',
      'onRemove',
      'getTimeoutMillis'
    ]
    for (const optionKey of optionsKeys) {
      if (!allowedOptions.includes(optionKey)) {
        throw new Error(`Option "${optionKey}" is not allowed`)
      }
    }
    // Create
    const create = options.create
    if (!create) {
      throw new Error('Option "create" is required')
    }
    if (typeof create !== 'function') {
      throw new Error('Option "create" should be a function')
    }
    this._create = async (...args) => create(...args)
    // On remove
    this._onRemove = typeof options.onRemove === 'function'
      ? async (...args) => options.onRemove(...args)
      : null
    // Max
    const max = options.max === undefined ? 1 : parseInt(options.max, 10)
    if (max <= 0) {
      throw new Error('Option "max" should be greater than 0')
    }
    this.max = max
    // Idle timeout
    const idleTimeoutMillis = options.idleTimeoutMillis === undefined
      ? 0
      : parseInt(options.idleTimeoutMillis, 10)
    this.idleTimeoutMillis = idleTimeoutMillis
    // Get timeout
    const getTimeoutMillis = parseInt(options.getTimeoutMillis, 10)
    this.getTimeoutMillis = getTimeoutMillis > 0 ? getTimeoutMillis : 30000
    this._pool = []
    this._waiters = []
    this.destroyed = false
    // Tick
    this._tick()
  }

  get size () {
    return this._pool.length
  }

  get ({ timeout } = {}) {
    const d = parseInt(timeout, 10) || this.getTimeoutMillis
    const promise = new Promise((resolve, reject) => {
      this._waiters.push({
        dateTimeoutAt: Date.now() + d,
        resolve,
        reject
      })
    })
    return promise
  }

  async destroy () {
    this.destroyed = true
    if (this._onRemove) {
      for (const poolItem of this._pool) {
        if (poolItem.ready) {
          this._onRemove(poolItem.client).catch(err => this.emit('error', err))
        }
      }
    }
    this._pool = []
  }

  _tick () {
    if (this.destroyed) return
    // Clear old waiters
    const newWairers = []
    const now = Date.now()
    for (const waiter of this._waiters) {
      if (waiter.dateTimeoutAt > now) {
        newWairers.push(waiter)
      } else {
        waiter.resolve()
      }
    }
    this._waiters = newWairers
    // Fill the pool if isn't full
    const poolSize = this._pool.length
    const max = this.max
    if (poolSize < max) {
      const poolItem = {
        date: Date.now(),
        ready: false
      }
      this._pool.push(poolItem)
      this._create()
        .then(client => {
          if (client === null) {
            // Remove pool item
            const index = this._pool.indexOf(poolItem)
            if (index !== -1) {
              this._pool.splice(index, 1)
            }
            return
          }
          poolItem.client = client
          poolItem.ready = true
        })
        .catch(err => {
          // Emit error
          this.emit('error', err)
          // Remove pool item
          const index = this._pool.indexOf(poolItem)
          if (index !== -1) {
            this._pool.splice(index, 1)
          }
        })
    }
    // Put the pool data to waiters
    const waitersCount = this._waiters.length
    if (waitersCount > 0) {
      const readyPoolItemIndex = this._pool.findIndex(el => el.ready === true)
      if (readyPoolItemIndex !== -1) {
        const poolItem = this._pool.splice(readyPoolItemIndex, 1)
        const waiter = this._waiters.shift()
        waiter.resolve(poolItem[0].client)
      }
    }
    // Remove old items from pool
    if (this.idleTimeoutMillis > 0 && this._pool.length > 0) {
      const date = Date.now() - this.idleTimeoutMillis
      const newPool = []
      for (const poolItem of this._pool) {
        if (poolItem.date > date) {
          newPool.push(poolItem)
        } else if (this._onRemove && poolItem.ready) {
          this._onRemove(poolItem.client).catch(err => this.emit('error', err))
        }
      }
      this._pool = newPool
    }
    // Repeat recursively
    if (!this.destroyed) {
      setTimeout(() => this._tick(), 5)
    }
  }
}

module.exports = DisposablePool
