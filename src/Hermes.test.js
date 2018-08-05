import Hermes from './Hermes'
import Reducer from './Reducer'

describe('#Hermes', () => {
  class TestReducer extends Reducer {
    static ACTIONS : Object = {
      CHANGE : 'testreducer.change'
    }
    
    static EVENTS : Object = {
      CHANGE : 'testreducer.change'
    }

    Reduce (action : Hermes.Action, state : Object = Object.create(null), payload : Object) {
      const newState : Object = {...state, ...payload}
    
      this.Dispatch(TestReducer.EVENTS.CHANGE, newState)

      return newState
    }

    Change (payload : Object) {
      return this.Action(TestReducer.ACTIONS.CHANGE, payload)
    }
  }

  class TestArrayReducer extends Reducer {
    static ACTIONS : Object = {
      CHANGE : 'testreducer.change'
    }
    
    static EVENTS : Object = {
      CHANGE : 'testreducer.change'
    }

    Reduce (action : Hermes.Action, state : Array = [], payload : Object) {
      const newState : Object = [...state, ...payload]
    
      this.Dispatch(TestReducer.EVENTS.CHANGE, newState)

      return newState
    }

    Change (payload : Object) {
      return this.Action(TestReducer.ACTIONS.CHANGE, payload)
    }    
  }

  test('Should be able to instantiate a heap definition from a path', () => {
    const hermes : Hermes = new Hermes({
      paths : {
        'test/test/test' : true
      }
    })

    expect(hermes).toHaveProperty('pathHeap')

    let i : number = -1
    const l : number = 2

    let target = hermes.pathHeap

    while (++i < l) {
      target = target.test

      expect(target).toHaveProperty('test')
    }

    target = target.test

    expect(target).toMatchObject({
      step : 'test',
      position : 3
    })
  })

  test('Should be able to instantiate a combined heap definition from multiple paths', () => {
    const hermes : Hermes = new Hermes({
      paths : {
        'test/test/test' : true,
        'test/test2/test' : true
      }
    })

    expect(hermes).toHaveProperty('pathHeap')
    expect(hermes.pathHeap.test).toHaveProperty('test')
    expect(hermes.pathHeap.test).toHaveProperty('test2')
  })

  test('Triggering an action on the store should generate the address with the payload data', (done : Function) => {
    const testReducer : TestReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test/test' : testReducer
      }
    })

    hermes.Subscribe(TestReducer.ACTIONS.CHANGE, (event : Object) => {
      expect(event).toHaveProperty('name')
      expect(event.name).toStrictEqual(TestReducer.EVENTS.CHANGE)

      expect(event).toHaveProperty('payload')
      expect(event.payload).toMatchObject({test : 'test'})

      expect(event).toHaveProperty('context')
      expect(event.context).toStrictEqual(undefined)

      done()
    })

    hermes.Do(testReducer.Change({test : 'test'}))

    let i : number = -1
    const l : number = 2

    let target = hermes.store

    while (++i < l) {
      target = target.test

      expect(target).toHaveProperty('test')
    }

    expect(target).toMatchObject({test : 'test'})
  })

  test('Arrays are handled same as Objects would be', (done : Function) => {
    const testArrayReducer : TestArrayReducer = new TestArrayReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test/test' : testArrayReducer
      }
    })

    hermes.Subscribe(TestArrayReducer.ACTIONS.CHANGE, (event : Object) => {
      expect(event).toHaveProperty('name')
      expect(event.name).toStrictEqual(TestArrayReducer.EVENTS.CHANGE)

      expect(event).toHaveProperty('payload')
      expect(event.payload).toEqual(expect.arrayContaining([1,2,3]))

      expect(event).toHaveProperty('context')
      expect(event.context).toStrictEqual(undefined)

      done()
    })

    hermes.Do(testArrayReducer.Change([1, 2, 3]))

    let i : number = -1
    const l : number = 2

    let target = hermes.store

    while (++i < l) {
      target = target.test
    }

    expect(target).toHaveLength(3)
    expect(target).toEqual(expect.arrayContaining([1,2,3]))
  })
})