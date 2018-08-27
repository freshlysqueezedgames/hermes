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
      this.Dispatch(TestReducer.EVENTS.CHANGE)

      return {...state, ...payload}
    }

    Change (payload : Object, context? : Object) {
      return this.Action(TestReducer.ACTIONS.CHANGE, payload, context)
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
      this.Dispatch(TestReducer.EVENTS.CHANGE)

      if (!payload) {
        return state
      }

      return [...state, ...payload]
    }

    Change (payload : Object, context? : Object) {
      return this.Action(TestReducer.ACTIONS.CHANGE, payload, context)
    }    
  }

  test('Triggering an action on the store should generate the address with the payload data', (done : Function) => {
    const testReducer : TestReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test/test' : testReducer
      }
    })

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, (event : Object) => {
      expect(event).toHaveProperty('name')
      expect(event.name).toStrictEqual(TestReducer.EVENTS.CHANGE)

      expect(event).toHaveProperty('payload')
      expect(event.payload).toMatchObject({test : 'test'})

      expect(event).toHaveProperty('path')
      expect(event.path).toStrictEqual('test/test')

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

    hermes.Subscribe(TestArrayReducer.EVENTS.CHANGE, (event : Object) => {
      expect(event).toHaveProperty('name')
      expect(event.name).toStrictEqual(TestArrayReducer.EVENTS.CHANGE)

      expect(event).toHaveProperty('payload')
      expect(event.payload).toEqual(expect.arrayContaining([1,2,3]))

      expect(event).toHaveProperty('path')
      expect(event.path).toStrictEqual('test/test')

      done()

      return true
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

  test('Only one instance can be applied to any one route', () => {
    let testReducer : TestReducer = new TestReducer
    
    expect(() => new Hermes({
      reducers : {
        'test' : testReducer,
        'test/test' : testReducer
      }
    })).toThrowError()

    testReducer = new TestReducer
    const testReducer2 : TestReducer = new TestReducer

    expect(() => new Hermes({
      reducers : {
        'test' : testReducer,
        'test/test' : testReducer2
      }
    })).not.toThrowError()
  })

  test('Multiple reducers should only fire events on the router at an exact path if a context is defined', (done : Function) => {
    const testReducer : TestReducer = new TestReducer
    const testReducer2 : TestReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test' : testReducer,
        'test/test' : testReducer2
      }
    })

    const data : Object = {
      test : 'test'
    }

    const correctMock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject(data)
      done()
    })

    const incorrectMock : Jest.Mock = jest.fn()

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, correctMock, 'test')
    hermes.Subscribe(TestReducer.EVENTS.CHANGE, incorrectMock, 'test/test')

    hermes.Do(testReducer.Change(data), 'test')

    expect(correctMock).toHaveBeenCalledTimes(1)
    expect(incorrectMock).not.toHaveBeenCalled()
  })

  // We should get a map indicating the path variable and its value.
  // @carl - the problem is that paths cannot be literally matched. Paths could be matched based on the regex of certain 
  // keys. SO we need to have a way of matching reducers with the path based on that. 
  test('Regex paths should be matched correctly', () => {
    const testReducer : TestReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        '/a/b' : testReducer
      }
    })

    const data : Object = {
      test : 'test'
    }

    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject(data)
      expect(event.context).toMatchObject({
        index : 'b'
      })
    })

    const mock2 : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject(data)
      expect(event.context).toMatchObject({
        '0' : 'b'
      })
    })

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, mock, '/a/:index')
    hermes.Subscribe(TestReducer.EVENTS.CHANGE, mock2, '/a/(b|c)')

    hermes.Do(testReducer.Change(data))

    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock2).toHaveBeenCalledTimes(1)
  })

  test('Regex paths for reducers should be matched correctly', () => {
    class ContextReducer extends Reducer {
      static ACTIONS : Object = {
        CHANGE : 'testreducer.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'testreducer.change'
      }
  
      Reduce (action : Hermes.Action, state : Object = Object.create(null), payload : Object) {
        if (action.name === '__init__') {
          return state
        }

        expect(action.name).toEqual(ContextReducer.ACTIONS.CHANGE)

        this.Dispatch(ContextReducer.EVENTS.CHANGE)

        return {...state, ...payload}
      }
  
      Change (payload : Object, context : Object) {
        return this.Action(ContextReducer.ACTIONS.CHANGE, payload, context)
      }
    }

    const contextReducer : ContextReducer = new ContextReducer

    const hermes : Hermes = new Hermes({
      reducers : {
       'a/:index' : contextReducer
      }
    })

    const data : Object = {
      test : 'test'
    }
  
    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject(data)
      expect(event.context).toMatchObject({index : 'b'})
    })

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, mock, 'a/b')
    hermes.Do(contextReducer.Change(data, {index : 'b'}))

    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('Subscribers and Reducers can both match by ambiguous paths', () => {
    class ContextReducer extends Reducer {
      static ACTIONS : Object = {
        CHANGE : 'testreducer.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'testreducer.change'
      }
  
      Reduce (action : Hermes.Action, state : Object = Object.create(null), payload : Object) {
        if (action.name === '__init__') {
          return
        }  

        expect(action.name).toEqual(ContextReducer.ACTIONS.CHANGE)

        this.Dispatch(ContextReducer.EVENTS.CHANGE)

        return {...state, ...payload}
      }
  
      Change (payload : Object, context : Object) {
        return this.Action(ContextReducer.ACTIONS.CHANGE, payload, context)
      }
    }

    const contextReducer : ContextReducer = new ContextReducer

    const hermes : Hermes = new Hermes({
      reducers : {
       'a/:index' : contextReducer
      }
    })

    const data : Object = {
      test : 'test'
    }
  
    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject(data)
      expect(event.context).toMatchObject({index : 'b'})
    })

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, mock, 'a/:foo')
    hermes.Do(contextReducer.Change(data, {index : 'b'}))

    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('Subscribers and Reducers can both match by ambiguous paths', () => {
    console.log('next!')

    class ContextReducer extends Reducer {
      static ACTIONS : Object = {
        CHANGE : 'contextreducer.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'contextreducer.change'
      }
  
      Reduce (action : Hermes.Action, state : Object = Object.create(null), payload : Object) {
        if (action.name === '__init__') {
          return state
        }
  
        expect(action.name).toEqual(ContextReducer.ACTIONS.CHANGE)

        this.Dispatch(ContextReducer.EVENTS.CHANGE)

        return {...state, ...payload}
      }
  
      Change (payload : Object, context : Object) {
        return this.Action(ContextReducer.ACTIONS.CHANGE, payload, context)
      }
    }

    class ContextReducer2 extends Reducer {
      static ACTIONS : Object = {
        CHANGE : 'contextreducer2.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'contextreducer2.change'
      }
  
      Reduce (action : Hermes.Action, state : Object = Object.create(null), payload : Object) {
        if (action.name === '__init__') {
          return state
        }

        expect(action.name).toEqual(ContextReducer.ACTIONS.CHANGE) // we expect the original action.
        expect(state).toMatchObject({
          test : 'test' // this means that the first reducer has applied it's state
        })

        this.Dispatch(ContextReducer2.EVENTS.CHANGE)

        return {...state, test2 : 'test2'}
      }
  
      Change (payload : Object, context : Object) {
        return this.Action(ContextReducer2.ACTIONS.CHANGE, payload, context)
      }
    }

    const contextReducer : ContextReducer = new ContextReducer
    const contextReducer2 : ContextReducer2 = new ContextReducer2
    
    const hermes : Hermes = new Hermes({
      reducers : {
       'a/:index' : contextReducer,
       'a/b' : contextReducer2
      }
    })

    const data : Object = {
      test : 'test'
    }
  
    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject({
        test : 'test',
        test2 : 'test2'
      })
      expect(event.context).toMatchObject({index : 'b'})
    })

    hermes.Subscribe(ContextReducer.EVENTS.CHANGE, mock, 'a/b')
    hermes.Do(contextReducer.Change(data, {index : 'b'}))

    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('Should be able to accept a plugin object with paths and a request function', (done : Function) => {
    console.log('the world of the bean')

    const testReducer : TestReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test/test' : testReducer
      },
      remote : {
        paths : [
          'test/test'
        ],
        request : (path : string, action : Action, state : Object, resolve : Function) : boolean => {
          expect(path).toEqual('test/test')
          expect(state).toMatchObject({})

          resolve({more : 'data'})

          done()
        }
      }
    })

    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.path).toEqual('test/test')

      expect(event.payload).toMatchObject({
        test : 'test',
        more : 'data'
      })
    })

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, mock)

    hermes.Do(testReducer.Change({
      test : 'test'
    }))
  })

  test('Should preserve original values from the state', (done : Function) => {
    const testReducer : TestReducer = new TestReducer
    const childReducer : TestReducer = new TestReducer

    const store = new Hermes({
      reducers : {
        'parent' : testReducer,
        'parent/child' : childReducer
      }
    })

    store.Do(childReducer.Change({test : 'test'}))

    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject({
        test : 'test',
        test2 : 'test2'
      })

      done()

      return true
    })

    store.Subscribe(TestReducer.EVENTS.CHANGE, mock, 'parent/child')

    store.Do(childReducer.Change({test2 : 'test2'}))
  })

  test('Should preserve original values from the state for arrays', (done : Function) => {
    console.log('beans of nazareth')

    const testArrayReducer : TestArrayReducer = new TestArrayReducer
    const childReducer : TestReducer = new TestReducer

    const store = new Hermes({
      reducers : {
        'parent' : testArrayReducer,
        'parent/:index' : childReducer
      }
    })

    store.Do(childReducer.Change({test : 'test'}, {index : 0}))

    console.log('now we update')

    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject({
        test : 'test',
        test2 : 'test2'
      })

      console.log('beans alive!', event.payload)

      done()

      return true
    })

    const mock2 : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject([
        {test : 'test', test2 : 'test2'}
      ])
    })

    store.Subscribe(TestReducer.EVENTS.CHANGE, mock, 'parent/0')
    store.Subscribe(TestArrayReducer.EVENTS.CHANGE, mock2)

    store.Do(childReducer.Change({test2 : 'test2'}, {index : 0}))
  })
})