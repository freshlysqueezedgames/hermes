import Reducer from './Reducer'
import Action from './Action'

describe('#Reducer', () => {
  test('Should return a new action instance when call Action function', () => {
    const reducer : Reducer = new Reducer()

    expect(reducer).toBeInstanceOf(Reducer)

    expect(reducer.Action('test.action')).not.toEqual(reducer.Action('test.action'))
  })

  test('Should combine new custom data to the state regardless of action', () => {
    const reducer : Reducer = new Reducer()
    
    expect(reducer).toBeInstanceOf(Reducer)

    const payload : Object = {test : 'test'}
    const state : Object = reducer.Reduce(reducer.Action('test.action'), undefined, payload)

    expect(state).toMatchObject(payload)
  })

  test('Should be able to override who array as default', () => {
    const reducer : Reducer = new Reducer()

    expect(reducer).toBeInstanceOf(Reducer)

    const payload : Object = ['one', 'two']
    const state = reducer.Reduce(reducer.Action('test.action'), payload, payload)

    expect(state).toMatchObject(payload)
  })

  test('Should override original state with payload', () => {
    const reducer : Reducer = new Reducer()
    
    expect(reducer).toBeInstanceOf(Reducer)

    const state : Object = reducer.Reduce(reducer.Action('test.action'), ['test1'], ['test2'])

    expect(state).toMatchObject(['test2'])
  })

  test('Should dispatch to the Hermes instance bound to it at runtime with event name only', () => {
    const reducer : Reducer = new Reducer()
    
    const mock : Jest.Mock = jest.fn()

    reducer.hermes = {
      AddEvent : mock
    }

    expect(reducer).toBeInstanceOf(Reducer)

    const eventName : string = 'test.event'

    reducer.Dispatch(eventName)

    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith(eventName)
  })

  test('Should accept array to object type changes to the payload', () => {
    const reducer : Reducer = new Reducer()

    let state : Object = reducer.Reduce(reducer.Action('test.action'), ['test1'], {test : 1})

    expect(state).toMatchObject({
      test : 1
    })

    state = reducer.Reduce(reducer.Action('test.action'), {test : 1}, ['test1'])

    expect(state).toMatchObject(['test1'])
  })
})