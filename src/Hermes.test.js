import Hermes from './Hermes'
import Reducer from './Reducer'
import Action from './Action'

describe('#Hermes', () => {
  class TestReducer extends Reducer {
    static ACTIONS : Object = {
      CHANGE : 'actions.testreducer.change'
    }
    
    static EVENTS : Object = {
      CHANGE : 'events.testreducer.change'
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
      CHANGE : 'actions.testarrayreducer.change'
    }
    
    static EVENTS : Object = {
      CHANGE : 'events.testarrayreducer.change'
    }

    Reduce (action : Hermes.Action, state : Array = [], payload : Object) {    
      this.Dispatch(TestArrayReducer.EVENTS.CHANGE)

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
      expect(event).toHaveProperty('context')
      expect(event.context).toMatchObject({index: 'b'})

      return true
    })

    const mock2 : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject(data)
      expect(event.context).toMatchObject({
        '0' : 'b'
      })

      return true
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
        CHANGE : 'actions.testreducer.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'events.testreducer.change'
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
        CHANGE : 'actions.testreducer.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'events.testreducer.change'
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
      expect(event.context).toMatchObject({foo : 'b'})
    })

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, mock, 'a/:foo')
    hermes.Do(contextReducer.Change(data, {index : 'b'}))

    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('Subscribers and Reducers can both match by ambiguous paths', () => {
    class ContextReducer extends Reducer {
      static ACTIONS : Object = {
        CHANGE : 'actions.contextreducer.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'events.contextreducer.change'
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
        CHANGE : 'actions.contextreducer2.change'
      }
      
      static EVENTS : Object = {
        CHANGE : 'events.contextreducer2.change'
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
    const testArrayReducer : TestArrayReducer = new TestArrayReducer
    const childReducer : TestReducer = new TestReducer

    const store = new Hermes({
      reducers : {
        'parent' : testArrayReducer,
        'parent/:index' : childReducer
      }
    })

    store.Do(childReducer.Change({test : 'test'}, {index : 0}))

    const mock : Jest.Mock = jest.fn().mockImplementation((event : Object) => {
      expect(event.payload).toMatchObject({
        test : 'test',
        test2 : 'test2'
      })

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

  test('Should not trigger subscriptions once they have been removed', () => {
    const testReducer : TestReducer = new TestReducer

    const store = new Hermes({
      reducers : {
        'test' : testReducer
      }
    })

    const mock : Jest.Mock = jest.fn()

    store.Subscribe(TestReducer.EVENTS.CHANGE, mock)

    store.Do(testReducer.Change({test : 'test'}))    

    store.Unsubscribe(TestReducer.EVENTS.CHANGE, mock)

    store.Do(testReducer.Change({test : 'test2'}))

    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('Should remove all subscriptions', () => {
    const testReducer : TestReducer = new TestReducer

    const store = new Hermes({
      reducers : {
        'test' : testReducer
      }
    })

    const mock : Jest.Mock = jest.fn()

    store.Subscribe(TestReducer.EVENTS.CHANGE, mock)
    store.Subscribe(TestReducer.EVENTS.CHANGE, mock)

    store.Do(testReducer.Change({test : 'test'}))    

    store.Unsubscribe(TestReducer.EVENTS.CHANGE, mock)

    store.Do(testReducer.Change({test : 'test2'}))

    expect(mock).toHaveBeenCalledTimes(2)
  })

  test('Should remove all subscriptions if no callback defined', () => {
    const testReducer : TestReducer = new TestReducer

    const store = new Hermes({
      reducers : {
        'test' : testReducer
      }
    })

    const mock : Jest.Mock = jest.fn()

    store.Subscribe(TestReducer.EVENTS.CHANGE, mock)
    store.Subscribe(TestReducer.EVENTS.CHANGE, mock)
    store.Subscribe(TestReducer.EVENTS.CHANGE, mock)

    store.Do(testReducer.Change({test : 'test'}))

    store.Unsubscribe(TestReducer.EVENTS.CHANGE)

    store.Do(testReducer.Change({test : 'test2'}))

    expect(mock).toHaveBeenCalledTimes(3)
  })

  test('Should adapt to changes in state structure', async () => {
    const testReducer : TestReducer = new TestReducer

    const store = new Hermes({})

    const mock : Jest.Mock = jest.fn()

    await store.Do(testReducer.Change({test : 'test'}), 'test')
    
    let state : Object = store.GetState()

    expect(state).toMatchObject({
      test : {
        test : 'test'
      }
    })

    await store.Do(testReducer.Change(['test1']), 'test')

    state = store.GetState()

    expect(state).toMatchObject({
      test: [
        'test1'
      ]
    })

    await store.Do(testReducer.Change({test : 'test'}), 'test')

    state = store.GetState()

    expect(state).toMatchObject({
      test : {
        test : 'test'
      }
    })
  })

  test('Should adapt to changes in state structure at a nested level', async () => {
    const testReducer : TestReducer = new TestReducer

    const store = new Hermes({})

    const mock : Jest.Mock = jest.fn()

    await store.Do(testReducer.Change({test : {test : 'test'}}), 'test')
    
    let state : Object = store.GetState()

    expect(state).toMatchObject({
      test : {
        test : {
          test : 'test'
        }
      }
    })

    await store.Do(testReducer.Change(['test1']), 'test/test')

    state = store.GetState()

    expect(state).toMatchObject({
      test : {
        test: [
          'test1'
        ]
      }
    })
  })
  
  test('Should surface up context information to all called reducers', (done : Function) => {
    class ParentReducer extends Reducer {
      Reduce (action : Action, state : state, payload : payload) {
        if (action.name === '__init__') {
          return
        }

        expect(action.context).toHaveProperty('$$path')
        expect(action.context.$$path).toStrictEqual('test/0')
        expect(action.context).toHaveProperty('key')
        expect(action.context.key).toStrictEqual('0')

        done()
      }
    }

    const parentReducer : ParentReducer = new ParentReducer
    const testReducer : TestReducer = new TestReducer

    const store = new Hermes({
      reducers : {
        'test/:key' : parentReducer,
        'test/:key/test' : testReducer
      }
    })

    store.Do(testReducer.Change({test : 'test2'}), 'test/0')
  })

  test('Should always give context of matching leaf reducer', async () => {
    let callcount = 0

    class ParentReducer extends Reducer {
      Reduce (action : Action, state : state, payload : payload) {
        if (action.name === '__init__') {
          return state
        }

        expect(action.context).toMatchObject({
          $$path : 'test/0/test/bla',
          key : '0',
          something : 'bla'
        })

        switch (action.name) {
          case TestReducer.ACTIONS.CHANGE : {
            if (!callcount++) {
              return {...state, test2 : 'test2'}
            }

            return {...state}
          }
        }
      }
    }

    class ChildReducer extends TestReducer {
      Reduce (action : Action, state : state, payload : payload) {
        if (action.name === '__init__') {
          return state
        }

        expect(action.context).toMatchObject({
          $$path : 'test/0/test/bla',
          key : '0',
          something : 'bla'
        })

        return {...state, ...payload}
      }
    }

    const parentReducer : ParentReducer = new ParentReducer
    const childReducer : ChildReducer = new ChildReducer

    const store = new Hermes({
      reducers : {
        'test/:key' : parentReducer,
        'test/:key/test/:something' : childReducer
      }
    })

    await store.Do(childReducer.Change({test : 'test'}), 'test/0/test/bla')

    const state = store.GetState()

    expect(state).toMatchObject({
      test : {
        "0" : {
          test : {
            bla : {
              test : 'test'
            }
          },
          test2 : 'test2'
        }
      }
    })

    await store.Do(childReducer.Change({test2 : 'test2'}), 'test/0/test/bla')

    expect(store.GetState()).toMatchObject({
      test : {
        '0' : {
          test : {
            bla : {
              test : 'test',
              test2 : 'test2'
            }
          },
          test2 : 'test2'
        }
      }
    })
  })

  test('Should correctly return state when performing remote requests', (done : Function) => {
    let count = 0

    class ChildReducer extends Reducer {
      static ACTIONS : Object = {
        CHANGE : 'actions.childreducer.change'
      }

      static EVENTS : Object = {
        CHANGE : 'events.childreducer.change'
      }

      Reduce (action : Action, state : state = Object.create(null), payload : payload) {
        if (action.name === '__init__') {
          return state
        }

        expect(action.context).toMatchObject({
          $$path : 'test/0/test/bla',
          key : '0',
          something : 'bla'
        })

        this.Dispatch(ChildReducer.EVENTS.CHANGE)

        return {...state, ...payload}
      }

      Change (payload : Object) {
        return this.Action(ChildReducer.ACTIONS.CHANGE, payload)
      }
    }

    class ParentReducer extends Reducer {
      Reduce (action : Action, state : state, payload : payload) {
        if (action.name === '__init__') {
          return state
        }

        expect(action.context).toMatchObject({
          $$path : 'test/0/test/bla',
          key : '0',
          something : 'bla'
        })

        switch (action.name) {
          case ChildReducer.ACTIONS.CHANGE : {
            if (!count++) {
              return {...state, test2 : 'test2'}
            }

            return state
          }
        }
      }
    }

    const parentReducer : ParentReducer = new ParentReducer
    const childReducer : ChildReducer = new ChildReducer

    const store = new Hermes({
      reducers : {
        'test/:key' : parentReducer,
        'test/:key/test/:something' : childReducer
      },
      remote : {
        paths : [
          'test/:key/test/:something'
        ],
        request (path : string, action : Hermes.Action, state : Object, resolve : Function) {
          expect(path).toStrictEqual('test/:key/test/:something')
          resolve({
            test3 : 'test3'
          })
        }
      }
    })

    store.Subscribe(ChildReducer.EVENTS.CHANGE, () => {
      expect(store.GetState()).toMatchObject({
        test : {
          "0" : {
            test : {
              bla : {
                test : 'test',
                test3: 'test3'
              }
            },
            test2 : 'test2'
          }
        }
      })

      store.Subscribe(ChildReducer.EVENTS.CHANGE, (event) => {
        expect(store.GetState()).toMatchObject({
          test : {
            '0' : {
              test : {
                bla : {
                  test : 'test',
                  test3 : 'test3',
                  test2 : 'test2'
                }
              },
              test2 : 'test2'
            }
          }
        })

        done()

        return true
      })

      store.Do(childReducer.Change({test2 : 'test2'}), 'test/0/test/bla')

      return true
    })

    store.Do(childReducer.Change({test : 'test'}), 'test/0/test/bla')
  })

  test('Should return indexes regardless of dispatching reducer', (done : Function) => {
    const testReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test/:key' : new TestReducer
      }
    })

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, (event : Object) => {
      expect(event.context).toMatchObject({
        $$path : 'test/0',
        key : '0'
      })

      done()
    })

    hermes.Do(testReducer.Change({test : 'test'}), 'test/0')
  })

  test('Should return indexes regardless of dispatching reducer level', (done : Function) => {
    const testReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test': new TestReducer,
        'test/:key' : new TestReducer
      }
    })

    function Test (finished : boolean = false) {
      hermes.Subscribe(TestReducer.EVENTS.CHANGE, (event : Object) => {
        expect(event.context).toMatchObject({
          $$path : 'test/0',
          key : '0'
        })
      }, 'test')

      hermes.Do(testReducer.Change({test : 'test'}), 'test/0')

      if (finished) {
        done()
      } else {
        Test(true)
      }
    }

    Test()
  })

  test('Actions should trigger their own event', () => {
    const testReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      reducers : {
        'test': testReducer
      }
    })

    expect.assertions(1)

    hermes.Subscribe(TestReducer.ACTIONS.CHANGE, (event : Object) => {
      expect(event.payload).toMatchObject({
        test : 'test'
      })
    })

    hermes.Do(testReducer.Change({test : 'test'}))
  })

  test('Actions should not trigger their own event if specified not to', () => {
    const testReducer = new TestReducer

    const hermes : Hermes = new Hermes({
      dispatchActions : false,
      reducers : {
        'test': testReducer
      }
    })

    const mock : Jest.Mock = jest.fn()

    hermes.Subscribe(TestReducer.ACTIONS.CHANGE, mock)
    hermes.Do(testReducer.Change({test : 'test'}))
    
    expect(mock).not.toHaveBeenCalled()
  })

})