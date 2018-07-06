import {assert, expect} from 'chai'
import Hermes, {Reducer} from './Hermes'

class TestReducer extends Reducer {
  static ACTIONS: Object = {
    SET: 'testreducer.set'
  }

  static EVENTS: Object = {
    CHANGE: 'testreducer.change'
  }

  constructor (actions?: Object) {
    super({...TestReducer.ACTIONS, actions})
  }

  Reduce (action: Action, state: Object = {}, payload: Object): Object {
    const t : TestReducer = this
    const {context} = action
    const newState : Object = {...state, ...payload}

    t.Dispatch(TestReducer.EVENTS.CHANGE, newState)

    return newState
  }

  Set (target: Object): Object {
    return this.Action(TestReducer.ACTIONS.SET, {target})
  }
}

describe('#Hermes', () => {
  const testReducer : TestReducer = new TestReducer
  const hermes : Hermes = Hermes({
    name : 'test',
    reducers : {
      test : testReducer
    }
  })

  test ('Should be able to add plain data', (done : Function) => {
    console.log('adding the event1')

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, (result: Object) => {
      const {name, payload, context} = result

      console.log('thats the best way 1', name, payload, context, result)

      expect(name).to.be.a('string')
      expect(payload).to.be.an('object')
      expect(context).to.be.an('string')

      expect(name).to.equal('testreducer.change', 'Event name has not been preserved')
      expect(payload).to.have.deep.property('target', {test : 'test'}, 'Data has not mutated properly')
      expect(context).to.equal('test', 'Returns the wrong path')

      done()

      return true // important! unsubscribe or this will be invoked
    }, 'test')

    hermes.Do(testReducer.Set({
      test: 'test'
    }))
  })

  test ('Should be able to subscribe to specific projection', (done : Function) => {    

    console.log('adding the event2')

    hermes.Subscribe(TestReducer.EVENTS.CHANGE, (result: Object) => {
      const {name, payload, context} = result

      expect(name).to.be.a('string')
      expect(payload).to.be.an('object')
      expect(context).to.be.an('string')

      expect(name).to.equal('testreducer.change', 'Event name has not been preserved')
      expect(payload).to.have.property('test', 'test2', 'Data has not mutated properly')
      expect(context).to.equal('test', 'Returns the wrong path')

      done()

      return true
    }, 'test', {test : 'target/test'})

    hermes.Do(testReducer.Set({
      test: 'test2'
    }))
  })
})