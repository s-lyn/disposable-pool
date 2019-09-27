/* global describe, it, afterEach */
const assert = require('assert')
const sinon = require('sinon')
const DisposablePool = require('../src/index')

describe('DisposablePool', function () {
  let pool
  afterEach(async function () {
    if (pool) {
      await pool.destroy()
      pool = null
    }
  })
  it('should create and destroy pool', async function () {
    pool = new DisposablePool({
      create: () => {}
    })
    assert.strictEqual(typeof pool, 'object')
    assert.strictEqual(typeof pool.destroy, 'function')
    await pool.destroy()
  })
  it('should support the multiple destroy', async function () {
    pool = new DisposablePool({
      create: () => {}
    })
    await pool.destroy()
    await pool.destroy()
  })
  it('should check the "max" option', async function () {
    assert.throws(() => {
      pool = new DisposablePool({
        create: () => {},
        max: 0
      })
    }, /Option "max" should be greater than 0/i)
  })
  it('should check the required option', async function () {
    assert.throws(() => {
      pool = new DisposablePool()
    }, /Option "create" is required/i)
  })
  it('should not support the unknown options', async function () {
    assert.throws(() => {
      pool = new DisposablePool({
        adsghwauir: true
      })
    }, /Option "adsghwauir" is not allowed/i)
  })
  it('should create the clients', async function () {
    const createStub = sinon.stub().callsFake(() => ({}))
    pool = new DisposablePool({
      create: createStub,
      max: 2
    })
    // Wait and check
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.strictEqual(pool.size, 2)
    assert(createStub.calledTwice)
  })
  it('should create and get', async function () {
    let id = 0
    const createStub = sinon.stub().callsFake(async () => {
      return { id: ++id }
    })
    pool = new DisposablePool({
      create: createStub,
      max: 2
    })
    assert.deepStrictEqual(await pool.get(), { id: 1 })
    assert.deepStrictEqual(await pool.get(), { id: 2 })
    assert.deepStrictEqual(await pool.get(), { id: 3 })
    assert.deepStrictEqual(await pool.get(), { id: 4 })
  })
  it('should support to cancel the creation', async function () {
    let id = 0
    const createStub = sinon.stub().callsFake(async () => {
      const currentId = ++id
      return currentId % 3 === 0
        ? null
        : { id: currentId }
    })
    pool = new DisposablePool({
      create: createStub
    })
    assert.deepStrictEqual(await pool.get(), { id: 1 })
    assert.deepStrictEqual(await pool.get(), { id: 2 })
    assert.deepStrictEqual(await pool.get(), { id: 4 })
    assert.deepStrictEqual(await pool.get(), { id: 5 })
    assert.deepStrictEqual(await pool.get(), { id: 7 })
  })
  it('should support option "idleTimeoutMillis" and "onRemove"', async function () {
    let id = 0
    const createStub = sinon.stub().callsFake(() => ++id)
    const onRemoveSpy = sinon.spy()
    pool = new DisposablePool({
      create: createStub,
      onRemove: onRemoveSpy,
      idleTimeoutMillis: 1
    })
    // Wait and test
    await new Promise(resolve => setTimeout(resolve, 50))
    assert(createStub.called)
    const client = await pool.get()
    assert.deepStrictEqual(typeof client, 'number')
    assert(await pool.get() > 2)
    assert(onRemoveSpy.called)
    assert(onRemoveSpy.callCount > 2)
  })
  it('should autoremove on "create" returns NULL', async function () {
    let id = 0
    const createStub = sinon.stub().callsFake(() => {
      const currentId = ++id
      return currentId < 3 ? null : currentId
    })
    pool = new DisposablePool({
      create: createStub
    })
    // Wait and test
    await new Promise(resolve => setTimeout(resolve, 25))
    assert(createStub.called)
    assert.deepStrictEqual(await pool.get(), 3)
  })
  it('should "destroy" run "onRemove"', async function () {
    let i = 0
    const createStub = sinon.stub().callsFake(() => ++i)
    const onRemoveSpy = sinon.spy()
    pool = new DisposablePool({
      create: createStub,
      onRemove: onRemoveSpy,
      max: 2
    })
    // Wait and check
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.strictEqual(pool.size, 2)
    assert(!onRemoveSpy.called)
    await pool.destroy()
    assert(onRemoveSpy.calledTwice)
    assert(onRemoveSpy.firstCall.calledWith(1))
    assert(onRemoveSpy.secondCall.calledWith(2))
    await pool.destroy()
    assert(onRemoveSpy.calledTwice)
  })
  it('should catch errors', async function () {
    let i = 0
    const createStub = sinon.stub().callsFake(() => {
      const currId = ++i
      if (currId % 2 === 0) {
        throw new Error('Create error')
      }
      return currId
    })
    const onRemoveSpy = sinon.stub().throws('Remove error')
    const onErrorSpy = sinon.spy()
    pool = new DisposablePool({
      create: createStub,
      onRemove: onRemoveSpy,
      max: 2,
      idleTimeoutMillis: 1
    })
    pool.on('error', err => onErrorSpy(err.message || err.name))
    // Wait and check
    await new Promise(resolve => setTimeout(resolve, 50))
    assert(onErrorSpy.calledWith('Create error'))
    assert(onErrorSpy.calledWith('Remove error'))
  })
})
